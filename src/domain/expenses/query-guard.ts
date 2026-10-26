export type QueryTicket = { key: string; revision: number };

/** Ignore late responses after a query key changes or its screen unmounts. */
export class QueryGuard {
  private revision = 0;

  begin(key: string): QueryTicket {
    this.revision += 1;
    return { key, revision: this.revision };
  }

  isCurrent(ticket: QueryTicket, currentKey: string): boolean {
    return ticket.revision === this.revision && ticket.key === currentKey;
  }

  invalidate(): void {
    this.revision += 1;
  }
}
