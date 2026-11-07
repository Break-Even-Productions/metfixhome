/**
 * Chat deep-link landing. Full messaging UI lands in the chat PR on these routes:
 * - /account/chat
 * - /account/messages
 * - /account/messages/:conversationId
 */
import { Link, useRoute } from "wouter";
import DashboardLayout from "./DashboardLayout";

export default function AccountMessages() {
  const [, params] = useRoute("/account/messages/:conversationId");
  const conversationId = params?.conversationId?.trim() || null;

  return (
    <DashboardLayout
      title={conversationId ? "Conversation" : "Messages"}
      description="Chat on MetFix.org is coming soon. Notification deep links already resolve here."
    >
      <section className="account-card account-notif-stub">
        {conversationId ? (
          <p>
            Conversation <span className="account-mono">{conversationId}</span> will open
            here once messaging ships.
          </p>
        ) : (
          <p>Open a chat notification to jump into a thread, or start from Inbox.</p>
        )}
        <div className="account-notif-stub__actions">
          <Link href="/account/notifications" className="account-btn">
            Notifications
          </Link>
          <Link href="/account/inbox" className="account-btn account-btn--ghost">
            Inbox
          </Link>
        </div>
      </section>
    </DashboardLayout>
  );
}
