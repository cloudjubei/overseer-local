/**
 * Holds the latest `overseer://` link until the page says it listens, then
 * hands it over; while the page listens, links go straight through.
 */
export class DeepLinkInbox {
  private held: string | undefined
  private listening = false

  constructor(private readonly deliver: (url: string) => void) {}

  receive(url: string): void {
    if (this.listening) this.deliver(url)
    else this.held = url
  }

  setListening(listening: boolean): void {
    this.listening = listening
    if (!listening || this.held === undefined) return
    const url = this.held
    this.held = undefined
    this.deliver(url)
  }
}
