import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translate } from './i18n';

const PROXY = '/api?url='; // API cùng 1 project Vercel (api/index.js) -> /api
const TIMEOUT = 12000;
const INTERVAL_SEC = 6;

async function fetchWithTimeout(url, options, timeout = TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request Timeout')), timeout))
  ]);
}

async function resolveChannelId(id, onLog) {
  if (!id) return null;
  if (/^UC[0-9A-Za-z_-]{22}$/.test(id)) return id;
  const urls = [`https://www.youtube.com/@${id}`, `https://www.youtube.com/c/${id}`];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(PROXY + encodeURIComponent(url) + '&raw=true');
      const html = await res.text();
      const match = html.match(/rel=["']canonical["'] href=["']https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})["']/i);
      if (match) return match[1];
    } catch (e) {
      onLog?.('resolveChannelId: ' + e.message);
    }
  }
  return null;
}

async function checkLive(channelId, onLog) {
  try {
    const targetUrl = `https://www.youtube.com/channel/${channelId}/live`;
    const res = await fetchWithTimeout(PROXY + encodeURIComponent(targetUrl) + '&raw=true');
    if (res.status === 301 || res.status === 302 || res.status === 404) return null;
    const html = await res.text();
    const hasLiveSignal = html.includes('"isLive":true') || html.includes('"isLiveStream":true') || html.includes('iconType":"LIVE"');
    if (!hasLiveSignal) return null;
    const likeRegex = /"apiUrl"\s*:\s*"\/youtubei\/v1\/like\/like".*?"videoId"\s*:\s*"([\w-]{11})"/s;
    let m = html.match(likeRegex);
    if (m && m[1]) return m[1];
    m = html.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([\w-]{11})"/);
    if (m && m[1]) return m[1];
  } catch (e) {
    onLog?.('checkLive: ' + e.message);
  }
  return null;
}

async function fetchChannelAvatar(channelId, onLog) {
  try {
    const targetUrl = `https://www.youtube.com/channel/${channelId}`;
    const res = await fetchWithTimeout(PROXY + encodeURIComponent(targetUrl) + '&raw=true');
    const html = await res.text();
    const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (match && match[1]) return match[1];
  } catch (e) {
    onLog?.('fetchChannelAvatar: ' + e.message);
  }
  return null;
}

async function detectLanguageByIp() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    const loc = await res.json();
    if (res.ok && loc.success && loc.country_code === 'VN') return 'vi';
  } catch (e) {
    console.warn('IP language detection failed:', e.message);
  } finally {
    clearTimeout(timeoutId);
  }
  return 'en';
}

// Đoán ngôn ngữ ban đầu theo trình duyệt (sau đó sẽ được chốt lại bằng IP như cũ)
function guessLanguage() {
  return (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

// Chuẩn hoá thứ người dùng nhập: @handle, handle, Channel ID (UC...) hoặc dán cả link kênh YouTube.
// Trả về null nếu không hợp lệ.
function parseChannelInput(raw) {
  let v = (raw || '').trim();
  if (!v) return null;

  if (/youtube\.com|youtu\.be/i.test(v)) {
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v);
      const seg = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if (seg[0] && seg[0].startsWith('@')) v = seg[0];
      else if ((seg[0] === 'channel' || seg[0] === 'c') && seg[1]) v = seg[1];
      else return null;
    } catch {
      return null;
    }
  }

  v = v.replace(/^@+/, '');
  if (!v || /[\s/?#&=]/.test(v)) return null;
  return v;
}

function buildOverlayLink(id) {
  const base = window.location.origin + window.location.pathname;
  const prefix = /^UC[0-9A-Za-z_-]{22}$/.test(id) ? '' : '@';
  return `${base}?id=${prefix}${encodeURIComponent(id)}`;
}

export default function App() {
  const [status, setStatus] = useState(null); // { html, isError } — chỉ hiện 1 dòng trạng thái hiện tại
  const [exampleText, setExampleText] = useState('');
  const [exampleShow, setExampleShow] = useState(false);
  const [obsWarningVisible, setObsWarningVisible] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [pollingLive, setPollingLive] = useState(false);

  // Form tạo link ở trang chính
  const [channelInput, setChannelInput] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [genError, setGenError] = useState('');
  const [copied, setCopied] = useState(false);

  const initialLang = useMemo(guessLanguage, []);
  const [lang, setLang] = useState(initialLang);
  const languageRef = useRef(initialLang);
  const linkInputRef = useRef(null);
  const copyTimerRef = useRef(null);
  const hasStartedRef = useRef(false);
  const countdownRef = useRef(null);
  const exampleRunningRef = useRef(false);
  const exampleTimersRef = useRef([]);

  const hasQuery = useMemo(
    () => [...new URLSearchParams(window.location.search).keys()].length > 0,
    []
  );

  const identifier = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('id');
    if (!raw) return null;
    let id = raw.trim();
    if (id.startsWith('@')) id = id.substring(1);
    return id;
  }, []);

  const t = useCallback((key, values) => translate(languageRef.current, key, values), []);

  const appendLog = useCallback((line) => {
    const time = new Date().toTimeString().slice(0, 8);
    setLogLines((prev) => [...prev, `[${time}] ${line}`]);
  }, []);

  // Hiện 1 dòng trạng thái — dòng mới thay thế dòng cũ ngay lập tức, không có hiệu ứng trượt.
  const showStatus = useCallback((html, isError = false) => {
    setStatus({ html, isError });
  }, []);

  const showError = useCallback((html, logLine) => {
    showStatus(html, true);
    if (logLine) appendLog(logLine);
  }, [showStatus, appendLog]);

  const showExampleLoop = useCallback(() => {
    if (exampleRunningRef.current) return;
    exampleRunningRef.current = true;
    const texts = [
      t('exampleUrl') + ' ?id=UCEcZC1dyDrhWueALsmutdHA',
      t('exampleUrl') + ' ?id=@ten-kenh-cua-ban'
    ];
    let i = 0;
    const cycle = () => {
      setExampleText(texts[i]);
      setExampleShow(true);
      const hideTimer = setTimeout(() => setExampleShow(false), 4000);
      const nextTimer = setTimeout(() => {
        i = (i + 1) % texts.length;
        cycle();
      }, 5000);
      exampleTimersRef.current.push(hideTimer, nextTimer);
    };
    cycle();
  }, [t]);

  // Dọn timers khi unmount
  useEffect(() => {
    return () => {
      exampleTimersRef.current.forEach(clearTimeout);
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Trang chính (không có query): chốt ngôn ngữ theo IP cho form tạo link
  useEffect(() => {
    if (hasQuery) return;
    let cancelled = false;
    detectLanguageByIp().then((detected) => {
      if (cancelled) return;
      languageRef.current = detected;
      setLang(detected);
      document.documentElement.lang = detected;
      document.title = translate(detected, 'pageTitle');
    });
    return () => {
      cancelled = true;
    };
  }, [hasQuery]);

  // Luồng chính: phát hiện ngôn ngữ -> tìm kênh -> chờ live -> chuyển hướng
  useEffect(() => {
    if (!hasQuery) return; // trang chính — chỉ hiện ảnh + form tạo link, không chạy logic tìm live

    let cancelled = false;

    const startCountdown = (chId, sec) => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      let s = sec;
      showStatus(t('streamNotFound', { seconds: s }));
      countdownRef.current = setInterval(() => {
        s -= 1;
        if (s > 0) {
          showStatus(t('streamNotFound', { seconds: s }));
        } else {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          showStatus(t('retrying'));
          fetchLiveChat(chId, false);
        }
      }, 1000);
    };

    const fetchLiveChat = async (chId, showMsg = true) => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setPollingLive(true);
      if (showMsg) showStatus(t('gettingLive'));
      const vid = await checkLive(chId, appendLog);
      if (cancelled) return;
      if (vid && vid.length === 11) {
        setPollingLive(false);
        showStatus(t('redirecting'));
        setTimeout(() => {
          window.location.href = `https://www.youtube.com/live_chat?is_popout=1&v=${vid}`;
        }, 600);
      } else {
        startCountdown(chId, INTERVAL_SEC);
      }
    };

    const startAfterChannelIsReady = (chId) => {
      if (!window.obsstudio || typeof window.obsstudio.getControlLevel !== 'function') {
        fetchLiveChat(chId);
        return;
      }
      window.addEventListener('obsStreamingStarted', () => fetchLiveChat(chId), { once: true });
      window.obsstudio.getControlLevel((level) => {
        if (level < 1 || typeof window.obsstudio.getStatus !== 'function') {
          setObsWarningVisible(true);
          fetchLiveChat(chId);
          return;
        }
        window.obsstudio.getStatus((status) => {
          if (status.streaming) fetchLiveChat(chId);
          else showStatus(t('waitingForObs'));
        });
      });
    };

    const start = async () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      if (!identifier) {
        showError(t('wrongUrl'), 'invalid_identifier: missing "id" parameter');
        showExampleLoop();
        return;
      }

      try {
        showStatus(t('findingChannel'));
        const chId = await resolveChannelId(identifier, appendLog);
        if (cancelled) return;
        if (!chId) {
          showError(t('channelNotFound', { identifier }), `channel_not_found: "${identifier}"`);
          showExampleLoop();
          return;
        }
        startAfterChannelIsReady(chId);
        fetchChannelAvatar(chId, appendLog).then((url) => {
          if (!cancelled && url) setAvatarUrl(url);
        });
      } catch (e) {
        showError(t('unknownError'), 'start(): ' + e.message);
      }
    };

    (async () => {
      const lang = await detectLanguageByIp();
      if (cancelled) return;
      languageRef.current = lang;
      document.documentElement.lang = lang;
      document.title = t('pageTitle');
      start();
    })();

    return () => {
      cancelled = true;
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, identifier]);

  const toggleLog = () => setLogOpen((open) => !open);

  const handleChannelInputChange = (e) => {
    setChannelInput(e.target.value);
    setGeneratedLink('');
    setGenError('');
    setCopied(false);
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    const id = parseChannelInput(channelInput);
    if (!id) {
      setGeneratedLink('');
      setGenError(t('genInvalid'));
      return;
    }
    setGenError('');
    setCopied(false);
    setGeneratedLink(buildOverlayLink(id));
  };

  const handleCopy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(generatedLink);
      ok = true;
    } catch {
      // Fallback cho môi trường không có Clipboard API
      const el = linkInputRef.current;
      if (el) {
        el.focus();
        el.select();
        try {
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
      }
    }
    if (ok) {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="stage">
      {!hasQuery && (
        <div className="home" lang={lang}>
          <img className="idle-img" alt="MinhSoora" src="https://i.ibb.co/YT1SBMB8/kmc-20260916-153644.png" />

          <form className="gen" onSubmit={handleGenerate}>
            <div className="gen-row">
              <input
                className="gen-input"
                type="text"
                value={channelInput}
                onChange={handleChannelInputChange}
                placeholder={t('genPlaceholder')}
                aria-label={t('genPlaceholder')}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
              />
              <button className="gen-btn" type="submit">{t('genButton')}</button>
            </div>

            {genError && <p className="gen-error">{genError}</p>}

            {generatedLink && (
              <div className="gen-result">
                <div className="gen-row">
                  <input
                    ref={linkInputRef}
                    className="gen-input gen-link"
                    type="text"
                    readOnly
                    value={generatedLink}
                    onFocus={(e) => e.target.select()}
                    aria-label={t('genResultLabel')}
                  />
                  <button className="gen-btn" type="button" onClick={handleCopy}>
                    {copied ? t('genCopied') : t('genCopy')}
                  </button>
                </div>
                <p className="gen-hint">{t('genHint')}</p>
              </div>
            )}
          </form>
        </div>
      )}

      {hasQuery && (
        <div className="panel">
          {pollingLive && (
            <div className="avatar-wrap">
              {avatarUrl ? (
                <img className="avatar-img" src={avatarUrl} alt="channel avatar" />
              ) : (
                <div className="avatar-placeholder" />
              )}
            </div>
          )}

          {status && (
            <div className="status-box">
              <p
                className={`status ${status.isError ? 'is-error' : ''}`.trim()}
                dangerouslySetInnerHTML={{ __html: status.html }}
              />
            </div>
          )}

          {exampleText && <div className={`example ${exampleShow ? 'show' : ''}`}>{exampleText}</div>}

          {obsWarningVisible && <div className="obs-warning">{t('obsPermissionWarning')}</div>}

          {logLines.length > 0 && (
            <button className="log-toggle" type="button" onClick={toggleLog}>
              {logOpen ? t('hideLog') : t('showLog')}
            </button>
          )}

          {logLines.length > 0 && (
            <pre className={`log ${logOpen ? 'open' : ''}`}>{logLines.join('\n')}</pre>
          )}
        </div>
      )}
    </div>
  );
}
