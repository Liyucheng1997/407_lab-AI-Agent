# Agent 原理 · 三维图解

在线体验：https://liyucheng1997.github.io/407_lab-AI-Agent/

用 Three.js 搭的一个可交互三维模型，分 10 个章节讲清楚 **LLM、上下文、工具、Harness、Agent、Bot、多智能体** 之间的关系。

```bash
npm install
npm run dev      # 开发预览 http://localhost:5173
npm run build    # 打包到 dist/
```

## 一句话记住

> LLM 负责想，Harness 负责做，Agent 是两者合体后的「能干活」，Bot 是它面向人群的「门面」。

| 概念 | 是什么 | 类比 | 场景里的样子 |
| --- | --- | --- | --- |
| LLM | 预测下一个 token 的模型 | 大脑 | 中心发光的能量球 + 神经晶格 |
| 上下文 | 每次调用时模型能看到的全部输入 | 桌上的资料 | 左侧一叠"纸"，越聊越高 |
| 工具 | 模型可以请求调用的外部能力 | 双手与工具箱 | 外圈悬浮的图标面板 |
| Harness | 驱动循环、执行工具、管理上下文与安全的软件 | 身体、流程与规章 | 围绕核心的六个模块 + 循环轨道 |
| Agent | LLM + Harness + 工具，指向一个目标 | 能独立干活的员工 | 把上面全部包起来的蓝色边界 |
| Bot | 驻留在某个渠道、对外交互的形态 | 营业窗口 | 左侧的门户和聊天渠道 |
| 多智能体 | 多个 Agent 分工协作 | 一个团队 | 上方的三个迷你 Agent |

## 章节

0. 一张地图 —— 全貌与嵌套关系
1. LLM —— 逐 token「接龙」，含概率柱与采样
2. 上下文窗口 —— 整叠内容每次都要重新送进模型，满了要压缩
3. 工具调用 —— 模型只会输出调用请求，没人执行就落空
4. Harness —— 六个模块组装上来
5. Agent 循环实况 —— 修一个登录页 bug：读代码 → 搜索 → 改 → 测试失败 → 再改 → 通过（可暂停 / 单步）
6. Agent —— 单次调用 vs 工作流 vs Agent
7. Bot —— 切换「规则 Bot / LLM 聊天 Bot / Agent Bot」对比同一句话的结果
8. 多智能体 —— 派活给子 Agent，只收回摘要
9. 全景 —— 自由探索，点击任何部件看说明

操作：拖动旋转、滚轮缩放、点击部件弹出说明卡、← → 切换章节。

## 代码结构

```
src/
  core/    stage.js 渲染与镜头 · fx.js 淡入淡出/标签/脚本运行 · icons.js
  world/   llm · tokens · context · harness · tools · bot · subagents · environment · packets(数据流粒子)
  story/   chapters.js 章节文字与动画脚本 · flows.js 信息流动作 · info.js 点击说明
  ui/      ui.js 导航/讲解卡/翻页 · dom.js
  styles/  tokens.css 设计变量 · app.css
```

调试：控制台里 `__agentViz.go(5)` 跳章节，`await __agentViz.ff(10)` 快进 10 秒。
