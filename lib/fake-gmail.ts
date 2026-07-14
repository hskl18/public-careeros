import { GmailAdapterError, type GmailAdapter, type GmailListResponse, type GmailMessageResponse } from "./gmail-adapter";

export type FakeGmailScenario =
  | "backfill"
  | "rate_limit_once"
  | "expired_token"
  | "partial"
  | "malformed"
  | "reconnect_required";

const messages: Record<string, GmailMessageResponse> = {
  "fake-message-1": {
    id: "fake-message-1",
    threadId: "fake-thread-1",
    snippet: "Your Product Engineer online assessment is due 2026-08-01. Please reply when complete.",
    internalDate: "1785416400000",
    payload: {
      headers: [
        { name: "Subject", value: "Cedar Systems Product Engineer assessment" },
        { name: "From", value: "Cedar recruiting <recruiting@cedar.example>" },
        { name: "Date", value: "Thu, 30 Jul 2026 09:00:00 -0700" }
      ]
    }
  },
  "fake-message-2": {
    id: "fake-message-2",
    threadId: "fake-thread-1",
    snippet: "We would like to schedule your Product Engineer interview for 2026-08-04.",
    internalDate: "1785502800000",
    payload: {
      headers: [
        { name: "Subject", value: "Re: Cedar Systems Product Engineer assessment" },
        { name: "From", value: "Cedar recruiting <recruiting@cedar.example>" }
      ]
    }
  },
  "fake-message-3": {
    id: "fake-message-3",
    threadId: "fake-thread-2",
    snippet: "Thank you for applying for Backend Engineer. We received your application.",
    internalDate: "1785589200000",
    payload: {
      headers: [
        { name: "Subject", value: "Juniper Labs Backend Engineer application" },
        { name: "From", value: "Juniper talent <talent@juniper.example>" }
      ]
    }
  }
};

export function fakeGmailMessage(messageId: string) {
  return messages[messageId];
}

export function fakeGmailList(pageToken?: string): GmailListResponse {
  if (pageToken === "page-2") {
    return {
      messages: [
        { id: "fake-message-2", threadId: "fake-thread-1" },
        { id: "fake-message-3", threadId: "fake-thread-2" }
      ],
      resultSizeEstimate: 3
    };
  }
  return {
    messages: [
      { id: "fake-message-1", threadId: "fake-thread-1" },
      { id: "fake-message-2", threadId: "fake-thread-1" }
    ],
    nextPageToken: "page-2",
    resultSizeEstimate: 3
  };
}

export class FakeGmailAdapter implements GmailAdapter {
  private listCalls = 0;

  constructor(readonly scenario: FakeGmailScenario = "backfill") {}

  async listMessages(input: { pageToken?: string }): Promise<GmailListResponse> {
    this.listCalls += 1;
    if (this.scenario === "rate_limit_once" && this.listCalls === 1) {
      throw new GmailAdapterError("rate_limited", 1);
    }
    if (this.scenario === "reconnect_required") throw new GmailAdapterError("reconnect_required");
    if (this.scenario === "malformed") throw new GmailAdapterError("malformed_response");
    if (this.scenario === "partial") {
      return { messages: [{ id: "fake-message-3", threadId: "fake-thread-2" }], resultSizeEstimate: 1 };
    }
    return fakeGmailList(input.pageToken);
  }

  async getMessage(input: { messageId: string }): Promise<GmailMessageResponse> {
    const message = fakeGmailMessage(input.messageId);
    if (!message) throw new GmailAdapterError("malformed_response");
    return message;
  }
}
