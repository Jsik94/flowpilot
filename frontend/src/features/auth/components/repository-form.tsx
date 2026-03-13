import { useState } from 'react';
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
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const tokenGuidance = connectedRepo?.isPrivate
    ? '현재 연결된 레포는 private 입니다. workflow와 run 정보를 읽으려면 PAT가 필요합니다.'
    : '공개 레포는 PAT 없이도 조회할 수 있습니다. private 레포 또는 권한 제한이 걸린 경우에만 입력하세요.';

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
          <span className="field-label-row">
            <span>Personal Access Token (Optional)</span>
            <button
              aria-expanded={showTokenHelp}
              className="field-help-button"
              onClick={() => setShowTokenHelp((current) => !current)}
              type="button"
            >
              i
            </button>
          </span>
          <input
            value={value.token}
            onChange={(event) =>
              onChange({
                ...value,
                token: event.target.value,
              })
            }
            placeholder="public repo면 비워도 됩니다"
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

      <p className="panel-note token-guidance">{tokenGuidance}</p>

      {showTokenHelp ? (
        <div className="token-help-panel">
          <strong>PAT 발급 방법</strong>
          <ol className="token-help-list">
            <li>GitHub 우측 상단 프로필에서 `Settings`로 이동합니다.</li>
            <li>왼쪽 하단 `Developer settings`를 엽니다.</li>
            <li>`Personal access tokens`에서 `Fine-grained tokens` 또는 `Tokens (classic)`을 선택합니다.</li>
            <li>`Generate new token`을 눌러 만료일과 대상 레포를 지정합니다.</li>
            <li>권한은 최소한으로 주는 편이 좋습니다. 이 앱 기준으로는 `Metadata: Read-only`, `Contents: Read-only`, `Actions: Read-only`면 충분합니다.</li>
            <li>생성 후 토큰은 한 번만 보이므로 바로 복사해서 여기에 붙여 넣습니다.</li>
          </ol>
          <p className="panel-note">
            공개 레포는 PAT 없이도 조회됩니다. private 레포거나 권한이 필요한 run 정보가 막힐 때만 입력하세요.
          </p>
        </div>
      ) : null}

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
