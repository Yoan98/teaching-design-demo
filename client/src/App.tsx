// 教学活动设计模块 — 主应用
// 设计哲学：新功能主义，强制线性流程，顶部步骤条贯穿全程
// AI 面板在全局层挂载，主内容区随面板开关动态右移

import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import StepNav from "./components/StepNav";
import Step1Context from "./pages/Step1Context";
import Step2Model from "./pages/Step2Model";
import Step3PathInstance from "./pages/Step3PathInstance";
import Step4Activity from "./pages/Step4Activity";
import Step5Preview from "./pages/Step5Preview";
import { AiPanel, defaultAiPanelState, type AiPanelState, type AiContext } from "./components/AiPanel";
import { useAppStore } from "./lib/store";

// 将 AiPanel 状态和 open 方法通过 Context 传递给子页面
import { createContext, useContext } from "react";

interface AiPanelContextValue {
  panelState: AiPanelState;
  openPanel: (context: AiContext, nodeId?: string) => void;
  setPanelState: (state: AiPanelState) => void;
}

export const AiPanelContext = createContext<AiPanelContextValue>({
  panelState: defaultAiPanelState,
  openPanel: () => {},
  setPanelState: () => {},
});

export function useAiPanel() {
  return useContext(AiPanelContext);
}

function StepRouter() {
  const currentStep = useAppStore((s) => s.currentStep);

  const pages = {
    1: <Step1Context />,
    2: <Step2Model />,
    3: <Step3PathInstance />,
    4: <Step4Activity />,
    5: <Step5Preview />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        {pages[currentStep as keyof typeof pages]}
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const [panelState, setPanelState] = useState<AiPanelState>(defaultAiPanelState);

  const openPanel = (context: AiContext, nodeId?: string) => {
    setPanelState(prev => ({
      ...prev,
      isOpen: true,
      activeContext: context,
      activeNodeId: nodeId,
    }));
  };

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <AiPanelContext.Provider value={{ panelState, openPanel, setPanelState }}>
            {/* 整体布局：主内容区 + AI 面板并排 */}
            <div className="min-h-screen bg-background flex">
              {/* 主内容区：面板打开时右侧留出 360px */}
              <motion.div
                className="flex-1 min-w-0 flex flex-col"
                animate={{ marginRight: panelState.isOpen ? '360px' : '0px' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              >
                <StepNav />
                <StepRouter />
              </motion.div>

              {/* AI 面板（fixed 定位，不占文档流） */}
              <AiPanel
                state={panelState}
                onChange={setPanelState}
              />
            </div>
          </AiPanelContext.Provider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
