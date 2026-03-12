export type AnalyzeRequest = {
  repo?: {
    owner?: string;
    name?: string;
    language?: string;
  };
  workflows?: Array<{
    fileName?: string;
    content?: string;
  }>;
};

export class AnalyzeService {
  analyze(payload: AnalyzeRequest) {
    const fileName = payload.workflows?.[0]?.fileName ?? 'workflow.yml';

    return {
      summary: `${fileName} 기준으로 3개의 초기 이슈가 감지되었습니다.`,
      issues: [
        {
          id: 'mock-critical-permissions',
          severity: 'critical',
          category: 'security',
          file: fileName,
          job: 'deploy',
          title: '권한 범위가 넓습니다',
          description: '배포 Job에서 write 권한이 광범위하게 열려 있습니다.',
          suggestion: '필요한 scope만 남기고 permissions를 축소하세요.',
        },
        {
          id: 'mock-warning-cache',
          severity: 'warning',
          category: 'performance',
          file: fileName,
          job: 'build',
          title: '의존성 캐시가 없습니다',
          description: '동일한 의존성 설치가 반복되어 실행 시간이 늘어납니다.',
          suggestion: 'setup-node cache 또는 actions/cache를 적용하세요.',
        },
        {
          id: 'mock-info-timeout',
          severity: 'info',
          category: 'structure',
          file: fileName,
          title: 'timeout 설정이 없습니다',
          description: '장시간 대기 시 러너 점유가 길어질 수 있습니다.',
          suggestion: 'workflow 또는 job 수준 timeout을 명시하세요.',
        },
      ],
    };
  }
}
