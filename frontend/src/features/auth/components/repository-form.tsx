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
  const isPrivateMode = value.repoVisibility === 'private';
  const isConnectedPrivate = connectedRepo?.isPrivate ?? false;
  const tokenGuidance = connectedRepo?.isPrivate || isPrivateMode
    ? 'private 레포는 PAT가 필요할 수 있습니다. workflow source와 run 이력을 읽으려면 Actions/Contents 읽기 권한을 포함하세요.'
    : '공개 레포는 PAT 없이도 조회할 수 있습니다. private 레포거나 권한 제한이 걸린 경우에만 입력하세요.';

  return (
    <section className="panel panel-hero">
      <div className="hero-toolbar">
        <div className="section-heading">
          <p className="eyebrow">Repository</p>
          <h1>FlowPilot로 GitHub Actions 구조를 빠르게 읽습니다.</h1>
          <p className="muted">
            레포 연결부터 브랜치 선택, workflow source 확인까지 한 흐름으로 정리합니다.
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

      <div className="repository-hero-grid">
        <div className="repository-hero-main">
          <div className="repository-form">
            <label className="repository-url-field">
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

            <div className="visibility-field">
              <span>Repository Visibility</span>
              <div className="visibility-toggle" role="group" aria-label="Repository visibility">
                <button
                  className={`visibility-option ${!isPrivateMode ? 'is-active' : ''}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      repoVisibility: 'public',
                    })
                  }
                  type="button"
                >
                  Public
                </button>
                <button
                  className={`visibility-option ${isPrivateMode ? 'is-active' : ''}`}
                  onClick={() =>
                    onChange({
                      ...value,
                      repoVisibility: 'private',
                    })
                  }
                  type="button"
                >
                  Private
                </button>
              </div>
              <p className="panel-note visibility-caption">
                {isPrivateMode
                  ? 'private 모드에서는 PAT와 Actions 읽기 권한이 필요할 수 있습니다.'
                  : 'public 모드는 토큰 없이 바로 workflow를 읽습니다.'}
              </p>
            </div>

            {isPrivateMode ? (
              <div className="private-auth-grid">
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
                    <span>Personal Access Token</span>
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
                    placeholder="private repo access token"
                    type="password"
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="repository-cta-row">
            <button
              className="button button-primary"
              disabled={loading}
              onClick={onSubmit}
              type="button"
            >
              {loading ? 'Loading...' : 'Load Repository'}
            </button>
            <div className="repository-cta-copy">
              <strong>{isPrivateMode ? '인증 후 workflow를 로드합니다.' : '즉시 workflow를 조회합니다.'}</strong>
              <p className="panel-note form-actions-note">
                {isPrivateMode
                  ? 'private 레포라면 PAT를 넣고 연결하세요.'
                  : 'public 레포는 바로 조회할 수 있습니다.'}
              </p>
            </div>
          </div>

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
              <p className="panel-note branch-note">
                브랜치를 바꾸면 해당 브랜치의 `.github/workflows` 기준으로 다시 로드합니다.
              </p>
            </div>
          ) : null}

          <div className="panel-status-row repository-status-row">
            <div className="status-card">
              <span className="status-card-label">Connection</span>
              {connectedRepo ? (
                <p className="status-card-value">
                  <strong>{connectedRepo.fullName}</strong> · default branch{' '}
                  <strong>{connectedRepo.defaultBranch}</strong>
                </p>
              ) : (
                <p className="status-card-value">아직 레포가 연결되지 않았습니다.</p>
              )}
            </div>
            <div className={`status-card ${errorMessage ? 'is-error' : ''}`}>
              <span className="status-card-label">Access Guide</span>
              <p className={errorMessage ? 'inline-error' : 'panel-note'}>
                {errorMessage ?? tokenGuidance}
              </p>
            </div>
          </div>
        </div>

        <aside className="repository-sidecard">
          <p className="eyebrow">Quick Guide</p>
          <h2>{isPrivateMode ? 'Private 연결 준비' : 'Public 연결 준비'}</h2>
          <p className="panel-note">
            {isPrivateMode
              ? '권한이 부족하면 workflow source 또는 run 이력이 비어 보일 수 있습니다.'
              : '우선 public 레포 구조를 빠르게 확인한 뒤 필요한 경우 private 인증으로 전환할 수 있습니다.'}
          </p>
          <ul className="repository-side-list">
            <li>{isPrivateMode ? 'Contents / Actions 읽기 권한이 필요합니다.' : 'PAT 없이도 기본 조회가 가능합니다.'}</li>
            <li>{isPrivateMode ? 'PAT 발급 버튼으로 최소 권한만 설정하세요.' : 'run 이력 접근이 막히면 private 모드로 전환하세요.'}</li>
            <li>{isConnectedPrivate ? '현재 연결된 레포는 private 상태입니다.' : '레포 연결 후 실제 공개/비공개 상태를 자동으로 맞춥니다.'}</li>
          </ul>

          {isPrivateMode && showTokenHelp ? (
            <div className="token-help-panel token-help-panel-embedded">
              <strong>PAT 발급 방법</strong>
              <ol className="token-help-list">
                <li>GitHub 우측 상단 프로필에서 `Settings`로 이동합니다.</li>
                <li>왼쪽 하단 `Developer settings`를 엽니다.</li>
                <li>`Personal access tokens`에서 `Fine-grained tokens` 또는 `Tokens (classic)`을 선택합니다.</li>
                <li>`Generate new token`을 눌러 만료일과 대상 레포를 지정합니다.</li>
                <li>`Metadata`, `Contents`, `Actions`는 `Read-only` 권한으로 설정합니다.</li>
                <li>생성 직후 복사해서 위 입력칸에 붙여 넣습니다.</li>
              </ol>
            </div>
          ) : null}
        </aside>
      </div>

      {isPrivateMode && showTokenHelp ? null : (
        <p className="panel-note repository-footnote">
          {isPrivateMode
            ? 'private 레포에서 run 이력까지 읽으려면 `Actions: Read-only` 권한이 포함되어야 합니다.'
            : 'public 레포는 토큰 없이 먼저 확인하고, 권한 문제가 있을 때만 private 모드로 전환하면 됩니다.'}
        </p>
      )}
    </section>
  );
}
