# 谜题大富翁 · Web 完整版 v0.1

按《需求文档-玩法与主题设计.md》实现的完整可玩游戏：大富翁棋盘 + 拼图之门章节制 + 五个玩法（数独/扫雷/数方/星之战/杀手数独）+ 难度选择 + 广告占位流程 + 音效/特效。

## 运行

```bash
cd game
npm install        # 首次
npm run dev        # 开发预览 → http://localhost:5173
```

- **改配置**：直接编辑 `../config/*.csv`（难度奖励表/章节轨道表/全局参数），然后 `npm run config` 同步 + 刷新浏览器即可，无需改代码。
- **构建**：`npm run build` → `dist/`（gzip 约 22KB + 配置）。
- **生成器压测**：`node --experimental-strip-types scripts/gen-test.ts`。

## 调试钩子（浏览器控制台）

`window.DBG.winNow()` 直接通关当前玩法 ｜ `DBG.addDice(50)` 加骰子 ｜ `DBG.addPiece()` 加碎片 ｜ `DBG.completeGate()` 集齐当前拼图 ｜ `DBG.freePlay('数方')` ｜ `DBG.refresh()`

## 已知限制（v0.1）

- 数方 8×8（困难/专家）出题约 1–3 秒（界面有"出题中…"提示）；数独/扫雷/星之战毫秒级。
- 星之战规格统一 8×8·2：唯一解生成在更大盘面（10×10+）命中率趋近 0，需 SAT/模拟退火优化后再开放（已列入后续计划）。
- 广告为占位流程（3 秒倒计时模拟），接微信流量主/穿山甲时替换 `ui.ts showAdModal` 为真实 SDK。
- 每日挑战（益智之塔）、成就部分项、多语言为后续版本内容。

## 目录

```
src/
  puzzlekit.ts        # 五玩法生成器/求解器（纯逻辑，唯一解保证）
  core/config.ts      # 读取 config/*.csv
  core/meta.ts        # MetaEngine：章节状态机/移动反弹/难度结算/碎片保底
  core/save.ts        # localStorage 存档
  core/audio.ts       # WebAudio 合成音效
  core/fx.ts          # 飘字/飞行/彩带/数字滚动特效
  core/pictures.ts    # 程序化章节插画（拼图/拼图馆/开场）
  ui.ts               # HUD 与全部面板
  board.ts            # 大富翁棋盘场景/掷骰/移动/章节之门
  games.ts            # 五个玩法界面
  main.ts             # 启动装配
```
