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

export default function App() {
  const [statusItems, setStatusItems] = useState([]);
  const [exampleText, setExampleText] = useState('');
  const [exampleShow, setExampleShow] = useState(false);
  const [obsWarningVisible, setObsWarningVisible] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [logOpen, setLogOpen] = useState(false);

  const languageRef = useRef('en');
  const idRef = useRef(0);
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

  // Đẩy 1 dòng trạng thái mới vào ngăn xếp: dòng cũ chuyển sang "leave" (trượt lên & mờ dần),
  // dòng mới vào với "enter" rồi sẽ được flip sang trạng thái nghỉ (trượt vào) ở effect bên dưới.
  const pushStatus = useCallback((html, isError = false) => {
    const id = ++idRef.current;
    setStatusItems((prev) => {
      const leaving = prev.map((item) => (item.phase === 'leave' ? item : { ...item, phase: 'leave' }));
      return [...leaving, { id, html, isError, phase: 'enter' }];
    });
  }, []);

  const showError = useCallback((html, logLine) => {
    pushStatus(html, true);
    if (logLine) appendLog(logLine);
  }, [pushStatus, appendLog]);

  // Điều khiển hiệu ứng slide: flip "enter" -> nghỉ (active) ở khung hình kế tiếp;
  // dọn các item "leave" sau khi transition kết thúc.
  useEffect(() => {
    let raf = null;
    const hasEntering = statusItems.some((i) => i.phase === 'enter');
    if (hasEntering) {
      raf = requestAnimationFrame(() => {
        setStatusItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            if (item.phase === 'enter') {
              changed = true;
              return { ...item, phase: 'active' };
            }
            return item;
          });
          return changed ? next : prev;
        });
      });
    }

    const leavingIds = statusItems.filter((i) => i.phase === 'leave').map((i) => i.id);
    const timers = leavingIds.map((id) =>
      setTimeout(() => {
        setStatusItems((prev) => prev.filter((p) => p.id !== id));
      }, 700)
    );

    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [statusItems]);

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
    };
  }, []);

  // Luồng chính: phát hiện ngôn ngữ -> tìm kênh -> chờ live -> chuyển hướng
  useEffect(() => {
    if (!hasQuery) return; // idle state — chỉ hiện ảnh, không chạy gì thêm

    let cancelled = false;

    const startCountdown = (chId, sec) => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      let s = sec;
      pushStatus(t('streamNotFound', { seconds: s }));
      countdownRef.current = setInterval(() => {
        s -= 1;
        if (s > 0) {
          pushStatus(t('streamNotFound', { seconds: s }));
        } else {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          pushStatus(t('retrying'));
          fetchLiveChat(chId, false);
        }
      }, 1000);
    };

    const fetchLiveChat = async (chId, showMsg = true) => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      if (showMsg) pushStatus(t('gettingLive'));
      const vid = await checkLive(chId, appendLog);
      if (cancelled) return;
      if (vid && vid.length === 11) {
        pushStatus(t('redirecting'));
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
          else pushStatus(t('waitingForObs'));
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
        pushStatus(t('findingChannel'));
        const chId = await resolveChannelId(identifier, appendLog);
        if (cancelled) return;
        if (!chId) {
          showError(t('channelNotFound', { identifier }), `channel_not_found: "${identifier}"`);
          showExampleLoop();
          return;
        }
        startAfterChannelIsReady(chId);
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

  return (
    <div className="stage">
      {!hasQuery && (
        <img className="idle-img" alt="MinhSoora" src="https://i.ibb.co/YT1SBMB8/kmc-20260916-153644.png" />
      )}

      {hasQuery && (
        <div className="panel">
          <div className="status-viewport">
            {statusItems.map((item) => (
              <p
                key={item.id}
                className={[
                  'status',
                  item.isError ? 'is-error' : '',
                  item.phase === 'enter' ? 'enter' : item.phase === 'leave' ? 'leave' : ''
                ].join(' ').trim()}
                dangerouslySetInnerHTML={{ __html: item.html }}
              />
            ))}
          </div>

          <div className={`example ${exampleShow ? 'show' : ''}`}>{exampleText}</div>

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
