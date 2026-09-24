export const translations = {
  vi: {
    pageTitle: 'MinhSoora',
    wrongUrl: 'Link kênh đang thiếu hoặc chưa đúng. Hãy thêm <b>?id=ten-kenh</b> vào cuối URL.',
    findingChannel: 'Đang tìm kênh của bạn...',
    channelNotFound: 'Chưa tìm thấy kênh “{identifier}”. Hãy kiểm tra lại tên kênh.',
    exampleUrl: 'Ví dụ:',
    gettingLive: 'Đang kiểm tra kênh có đang livestream không...',
    streamNotFound: 'Chưa thấy livestream nào, sẽ thử lại sau {seconds}s...',
    retrying: 'Đang thử lại...',
    obsPermissionWarning: 'Trong OBS, vào Properties của Browser Source và đặt Page permissions thành “Read OBS Data”.',
    waitingForObs: 'Đang chờ OBS bắt đầu livestream...',
    redirecting: 'Đã tìm thấy livestream, đang mở khung chat cho bạn...',
    networkError: 'Không kết nối được tới proxy hoặc mạng, bạn thử lại sau nhé.',
    timeoutError: 'Yêu cầu mất quá nhiều thời gian và đã bị hủy.',
    unknownError: 'Rất tiếc, đã có lỗi không xác định xảy ra.',
    showLog: 'Xem chi tiết lỗi',
    hideLog: 'Ẩn chi tiết lỗi',
    genPlaceholder: 'Tên kênh YouTube (vd: @MinhSoora)',
    genButton: 'Tạo link',
    genInvalid: 'Tên kênh chưa hợp lệ. Hãy nhập @tên-kênh, Channel ID (UC...) hoặc link kênh YouTube.',
    genResultLabel: 'Link overlay',
    genCopy: 'Sao chép',
    genCopied: 'Đã sao chép',
    genHint: 'Dán link này vào Browser Source trong OBS.'
  },
  en: {
    pageTitle: 'MinhSoora // live chat overlay',
    wrongUrl: 'Your channel link is missing or incorrect. Add <b>?id=your-channel</b> to the end of the URL.',
    findingChannel: 'Looking up your channel...',
    channelNotFound: 'Couldn\u2019t find a channel called “{identifier}”. Please double-check the name.',
    exampleUrl: 'Example:',
    gettingLive: 'Checking whether this channel is live...',
    streamNotFound: 'No livestream yet — trying again in {seconds}s...',
    retrying: 'Retrying...',
    obsPermissionWarning: 'In OBS, open the Browser Source properties and set Page permissions to “Read OBS Data”.',
    waitingForObs: 'Waiting for OBS to start streaming...',
    redirecting: 'Livestream found — opening the chat box...',
    networkError: 'Couldn\u2019t reach the proxy or the network. Please try again shortly.',
    timeoutError: 'The request took too long and was cancelled.',
    unknownError: 'Something went wrong. Please try again.',
    showLog: 'Show error details',
    hideLog: 'Hide error details',
    genPlaceholder: 'YouTube channel name (e.g. @MinhSoora)',
    genButton: 'Generate link',
    genInvalid: 'That channel name isn\u2019t valid. Enter @handle, a Channel ID (UC...) or a YouTube channel link.',
    genResultLabel: 'Overlay link',
    genCopy: 'Copy',
    genCopied: 'Copied',
    genHint: 'Paste this link into a Browser Source in OBS.'
  }
};

export function translate(language, key, values) {
  let entry = (translations[language] && translations[language][key]) || translations.en[key] || key;
  if (values) {
    entry = entry.replace(/\{(\w+)\}/g, (_, name) => (values[name] ?? '{' + name + '}'));
  }
  return entry;
}
