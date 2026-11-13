import coyoteCodeLogo from "../assets/CoyoteCodeLogo.png";

type SidebarProps = {
  onNewChat: () => void;
  disabled: boolean;
};

export default function Sidebar({ onNewChat, disabled }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img className="sidebar-logo" src={coyoteCodeLogo} alt="CoyoteCode" />
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
