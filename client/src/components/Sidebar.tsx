type SidebarProps = {
  onNewChat: () => void;
  disabled: boolean;
};

export default function Sidebar({ onNewChat, disabled }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo-mark" aria-hidden="true">
          C
        </span>
        <span className="app-name">CoyoteCode</span>
      </div>

      <button
        className="new-chat-button"
        type="button"
        onClick={onNewChat}
        disabled={disabled}
      >
        <span aria-hidden="true">+</span>
        New chat
      </button>

      <p className="sidebar-label">Workspace</p>
      <p className="sidebar-note">Your coding assistant</p>
    </aside>
  );
}
