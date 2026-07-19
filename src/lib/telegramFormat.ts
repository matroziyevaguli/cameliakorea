// Convert the Markdown people actually write (**bold**, ~~strike~~, *italic*, _italic_) into
// Telegram-safe HTML, so posts sent with parse_mode:"HTML" render correctly.
// HTML mode only needs &, <, > escaped — much safer than Telegram's MarkdownV2 escaping.
export function mdToTelegramHtml(text: string): string {
  return (text || '')
    // 1) escape HTML specials first
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // 2) headings (#, ##, …) → bold (Telegram has no headings)
    .replace(/^#{1,6}[ \t]+(.+)$/gm, '<b>$1</b>')
    // 3) then map the common Markdown to Telegram HTML tags (pairs only — stray marks stay literal)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')   // **bold**
    .replace(/__(.+?)__/g, '<u>$1</u>')       // __underline__
    .replace(/~~(.+?)~~/g, '<s>$1</s>')       // ~~strikethrough~~
    .replace(/\*(.+?)\*/g, '<i>$1</i>')       // *italic*  (after ** already handled)
    .replace(/(?<![A-Za-z0-9])_(.+?)_(?![A-Za-z0-9])/g, '<i>$1</i>') // _italic_ (not inside words/@handles)
}
