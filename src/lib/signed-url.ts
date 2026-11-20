/**
 * Opens a file through a signed link issued by the API. The tab is opened during
 * the click, before the link is known, so that the browser does not block it.
 */
export async function openSignedUrl(
  load: () => Promise<{ url: string }>,
  onError: (error: unknown) => void,
) {
  const tab = window.open("", "_blank");
  try {
    const { url } = await load();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else window.location.assign(url);
  } catch (error) {
    tab?.close();
    onError(error);
  }
}
