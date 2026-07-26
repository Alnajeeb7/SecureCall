import { Github } from "lucide-react";

const REPO_URL = "https://github.com/Alnajeeb7/SecureCall";

export default function GithubBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="View source / contact the maintainer on GitHub"
      aria-label="View source / contact the maintainer on GitHub"
      className={`flex items-center justify-center w-9 h-9 shrink-0 rounded-full glass text-muted hover:text-ink hover:border-signal/50 transition ${className}`}
    >
      <Github size={18} />
    </a>
  );
}

export { REPO_URL };
