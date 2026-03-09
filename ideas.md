# 教学活动设计模块 Demo — 设计方案构思

## 方案一：「结构主义工作台」
<response>
<text>
**Design Movement**: 包豪斯功能主义 + 现代 SaaS 工具风格
**Core Principles**:
- 信息密度克制，每屏只聚焦一个决策
- 强调流程进度感，步骤导航始终可见
- 卡片作为信息容器，边界清晰，层级分明

**Color Philosophy**: 深蓝灰（#1E2A3A）作为主色，传递专业与权威；琥珀黄（#F59E0B）作为强调色，标记关键操作与状态；浅灰白（#F8FAFC）作为背景，保持阅读舒适度。

**Layout Paradigm**: 左侧固定步骤导航栏（64px）+ 主内容区，步骤之间以动画过渡，非滚动翻页。

**Signature Elements**:
- 步骤连接线（带动画填充的进度条）
- 卡片锁定状态（绿色对勾 + 灰化遮罩）
- 时间分配实时进度条

**Interaction Philosophy**: 每步完成才能推进，锁定机制强制确认，减少回头修改的冲动。

**Animation**: 卡片确认时有轻微收缩 + 绿色渐入；步骤切换时主内容区向左滑出。

**Typography System**: 标题用 Noto Serif SC（衬线感，权威），正文用 Noto Sans SC（清晰易读），代码/标签用等宽字体。
</text>
<probability>0.08</probability>
</response>

## 方案二：「认知地图导航台」
<response>
<text>
**Design Movement**: 信息建筑学 + 学术工具美学
**Core Principles**:
- 以「地图」隐喻贯穿全程，让老师感知自己在结构中的位置
- 节点与阶段用拓扑图可视化，而非纯文字列表
- 操作区与预览区并列，所见即所得

**Color Philosophy**: 石板蓝（#3B5BDB）为主色，象征认知与思维；薄荷绿（#12B886）为完成状态色；暖米色（#FFF9F0）为背景，降低长时间使用的视觉疲劳。

**Layout Paradigm**: 顶部步骤面包屑 + 三栏布局（左导航/中编辑/右预览），Path Instance 页面采用三栏，其余页面采用单栏居中。

**Signature Elements**:
- 阶段-节点树形可视化（带箭头连线）
- 时间分配甜甜圈图
- 右侧实时预览面板

**Interaction Philosophy**: 编辑与预览同步，减少老师对「最终效果」的不确定感。

**Animation**: 节点展开时有弹性展开动画；确认锁定时卡片边框变色并有轻微震动反馈。

**Typography System**: 标题用 ZCOOL XiaoWei（有设计感的中文衬线），正文用 Source Han Sans（工程感，清晰），标签用 DM Mono。
</text>
<probability>0.07</probability>
</response>

## 方案三：「教师工作流程台」（选定方案）
<response>
<text>
**Design Movement**: 新功能主义 + 教育科技工具风格
**Core Principles**:
- 流程感优先：顶部步骤条始终可见，当前步骤高亮
- 内容密度适中：卡片分块，避免长表单
- 状态可感知：锁定/未锁定/警告三种状态视觉差异明显

**Color Philosophy**: 主色用靛蓝（#4F46E5），传递专业与创新；辅助色用翠绿（#059669）标记已完成/已确认状态；警告色用橙红（#DC2626）标记超时/错误；背景用暖白（#FAFAF9），避免纯白的冷硬感。

**Layout Paradigm**: 顶部固定导航（步骤进度条）+ 主内容区居中（max-w-4xl），Path Instance 页面采用左侧阶段导航 + 中间瀑布流的两栏布局。

**Signature Elements**:
- 步骤进度条（带数字编号和连接线）
- 卡片锁定动画（绿色边框渐入 + 锁图标）
- 时间分配实时状态条（绿/黄/红三色）

**Interaction Philosophy**: 强制线性推进，但每步内部支持自由编辑；AI 对话浮层不打断主流程。

**Animation**: 页面切换用 framer-motion 的 slide 动画；卡片确认用 scale + opacity 过渡；超时警告用 pulse 动画。

**Typography System**: 标题用 Noto Serif SC 600（权威感）；正文用 Noto Sans SC 400（清晰）；标签/数字用系统等宽字体。
</text>
<probability>0.09</probability>
</response>

## 选定方案：方案三「教师工作流程台」
采用靛蓝主色 + 暖白背景 + 翠绿完成状态的配色体系，顶部步骤进度条贯穿全程，强制线性推进，Path Instance 页面采用两栏布局。
