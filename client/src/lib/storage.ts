// 本地持久化迁移服务

export function migratePersistedAppState(persistedState: unknown, version: number): unknown {
  if (!persistedState || typeof persistedState !== 'object') {
    return persistedState;
  }

  const state = persistedState as Record<string, unknown>;

  // v1 -> v2: 扩展 PathStatus、Context 与 Activity 字段
  if (version < 2) {
    const context = (state.context ?? {}) as Record<string, unknown>;
    const pathInstance = (state.pathInstance ?? {}) as Record<string, unknown>;

    const executionConstraints =
      (context.executionConstraints as Record<string, unknown>) || {
        deviceType: '无设备',
        softwareEnvironment: '浏览器',
        materialLevel: '简单材料（纸笔）',
        prepTime: '无准备',
        spaceMode: '个体',
        managementLevel: '中',
        costLevel: 0,
      };

    const normalizedStages = Array.isArray(pathInstance.stages)
      ? pathInstance.stages.map((stage) => {
          const stageRecord = (stage || {}) as Record<string, unknown>;
          const nodes = Array.isArray(stageRecord.nodes)
            ? stageRecord.nodes.map((node) => {
                const nodeRecord = (node || {}) as Record<string, unknown>;
                const activities = Array.isArray(nodeRecord.activities)
                  ? nodeRecord.activities.map((activity) => {
                      const activityRecord = (activity || {}) as Record<string, unknown>;
                      return {
                        templateId: null,
                        behaviorSequence: [],
                        ...activityRecord,
                      };
                    })
                  : [];
                return {
                  ...nodeRecord,
                  activities,
                };
              })
            : [];
          return {
            ...stageRecord,
            nodes,
          };
        })
      : [];

    return {
      ...state,
      context: {
        studentLevel: null,
        studentProfileId: null,
        executionConstraints,
        ...context,
      },
      pathInstance: {
        executionNotes: '',
        actualTimeUsed: {},
        revisionTrigger: '',
        planSummary: '',
        status: '草稿',
        ...pathInstance,
        stages: normalizedStages,
      },
    };
  }

  return persistedState;
}
