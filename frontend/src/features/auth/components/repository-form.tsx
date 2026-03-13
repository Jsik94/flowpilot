import type { BranchSummary, RepositoryFormState, RepositoryRef } from '../../../types';

type RepositoryFormProps = {
  value: RepositoryFormState;
  theme: 'dark' | 'light';
  loading: boolean;
  branchLoading: boolean;
  progressState: {
    label: string;
    current: number;
    total: number;
  } | null;
  branches: BranchSummary[];
  selectedBranch: string;
  errorMessage: string | null;
  connectedRepo: RepositoryRef | null;
  onChange: (next: RepositoryFormState) => void;
  onSubmit: () => void;
  onToggleTheme: () => void;
  onBranchChange: (branch: string) => void;
};

export function RepositoryForm({
  value,
  theme,
  loading,
  branchLoading,
  progressState,
  branches,
  selectedBranch,
  errorMessage,
  connectedRepo,
  onChange,
  onSubmit,
  onToggleTheme,
  onBranchChange,
}: RepositoryFormProps) {
  return (
    <section className="panel panel-hero">
      <div className="hero-toolbar">
        <div className="section-heading">
          <p className="eyebrow">Repository</p>
          <h1>GitHub workflow를 붙여서 바로 구조를 봅니다.</h1>
          <p className="muted">
            현재 단계는 실제 GitHub 레포 연결과 워크플로우 목록 로딩까지 구현합니다.
          </p>
        </div>

        <button
          className="button button-secondary button-theme"
          onClick={onToggleTheme}
          type="button"
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <div className="repository-form">
        <label>
          <span>Repository URL</span>
          <input
            value={value.repoUrl}
            onChange={(event) =>
              onChange({
                ...value,
                repoUrl: event.target.value,
              })
            }
            placeholder="https://github.com/owner/repo"
          />
        </label>
        <label>
          <span>GitHub Username</span>
          <input
            value={value.username}
            onChange={(event) =>
              onChange({
                ...value,
                username: event.target.value,
              })
            }
            placeholder="username"
          />
        </label>
        <label>
          <span>Personal Access Token</span>
          <input
            value={value.token}
            onChange={(event) =>
              onChange({
                ...value,
                token: event.target.value,
              })
            }
            type="password"
          />
        </label>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={loading}
            onClick={onSubmit}
            type="button"
          >
            {loading ? 'Loading...' : 'Load Repository'}
          </button>
        </div>
      </div>

      {connectedRepo ? (
        <div className="branch-row">
          <label className="branch-select">
            <span>Branch</span>
            <select
              disabled={branchLoading || branches.length === 0}
              onChange={(event) => onBranchChange(event.target.value)}
              value={selectedBranch}
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <p className="panel-note">
            브랜치를 바꾸면 해당 브랜치의 `.github/workflows` 기준으로 다시 로드합니다.
          </p>
        </div>
      ) : null}

      {progressState ? (
        <div className="progress-block">
          <div className="progress-meta">
            <span>{progressState.label}</span>
            {progressState.total > 1 ? (
              <span>
                {progressState.current}/{progressState.total}
              </span>
            ) : null}
          </div>
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{
                width: `${Math.max(
                  8,
                  (progressState.current / Math.max(progressState.total, 1)) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="panel-status-row">
        {connectedRepo ? (
          <p className="panel-note">
            Connected: <strong>{connectedRepo.fullName}</strong> · default branch{' '}
            <strong>{connectedRepo.defaultBranch}</strong>
          </p>
        ) : (
          <p className="panel-note">아직 레포가 연결되지 않았습니다.</p>
        )}
        {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
