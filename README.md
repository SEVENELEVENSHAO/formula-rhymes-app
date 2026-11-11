# 汤头歌诀 · 方歌研习

基于用户提供的《汤头歌诀白话解》第6版 EPUB，采用 Open Herbology 当前的黑色界面、彩色分类块、竖排药名与独立剂量成分卡。支持桌面、平板、手机与首次联网加载后的离线阅读。

在线访问：[汤头歌诀 · 方歌研习](https://sevenelevenshao.github.io/formula-rhymes-app/)。分类与方名位于左栏，中间直接阅读方歌及白话解。

## GitHub Pages 部署

推送 `main` 后，`.github/workflows/pages.yml` 会校验数据并构建、部署网站。Pages 发布源使用 GitHub Actions。`npm run build:pages` 输出至 `dist-pages/`，基础路径为 `/formula-rhymes-app/`，与本地运行的 `dist/` 分开。原 EPUB、ZIP、个人学习记录及工作文件不上传。

## 运行

需要 Node.js 20.19+ 或 22.12+。

```powershell
npm install
npm run dev
```

打开 http://127.0.0.1:5178/ 。生产版运行：

```powershell
npm run build
npm run preview
```

也可双击 `启动汤头歌诀.cmd`，自动构建并启动本地服务。此版本是本地 Web / PWA App，尚未制作 Android APK。

## 功能

- 依照原书的 20 类方剂和 3 个附篇浏览，共 315 个条目；增辑归入相应原书门类，附方保留在所属条目内。
- 以方名、拼音、拼音首字母、歌诀、组成及主治全文检索。
- 显示原书古制剂量；显式“各”字剂量按组展开；复杂炮制、缺失剂量或有歧义的条目保留原文。
- 药性关联 Open Herbology 的同名药材、异体字、别名及药材规格。白术与白朮等规范化匹配保留原书名称；炙甘草等炮制名称另标“基药参考”，不静默替换成甘草。
- 色彩分组沿用 Open Herbology：微温归温、微寒和微凉归凉。成分卡另显示“微寒”“大热”等原始药性标签，未知记录不默认为平。
- 芍药、贝母等含糊名称继续待核对；部分别名映射被拦截或改为基药参考。海螵蛸通过有出处的对应关系关联乌贼骨，未使用原别名表的桑螵蛸映射。
- 已匹配成分卡可查看药材性味、功用与本书同名关联方剂。
- 逐句遮盖背诵、方歌练习、熟记标记、收藏、自动保存笔记；学习记录可导出 JSON 或合并导入。
- 每条保留 EPUB 文件名、锚点以及原书文本、上下标和字形图片；阅读界面可切换“原书全文”。

## 数据与边界

源 EPUB 保留不变。`scripts/import_book.py` 按 OPF 阅读顺序读取完整解说部分 CHP2，跳过重复的 CHP1 歌诀汇编，输出 `src/data/book.json` 与 `work/import-report.json`。导入器不执行书中内容；原文渲染只允许有限格式标签和本地字形图片。

`scripts/herb_matching.py` 保存规范化、别名冲突、基药参考及暂缓匹配策略。每个药味记录包含原书药名、药性标签、匹配方式、参考药名及出处；报告保留参考文件 SHA-256、匹配统计和待补药名。新增别名来源默认为 `--herbs` 同目录的 `raw-herb-aliases.json`，也可用 `--aliases` 指定。来源数据未在 Open Herbology 原项目中改动。

海螵蛸与乌贼骨的名称关系核对来源：[国家中医药研究所标本馆](https://www.nricm.edu.tw/htcm/catalog/tcm_herbal_detailse24d.html?id=910)。药性字段仍保留 Open Herbology 对应记录的原文，没有混入其他来源的剂量或功效。

重新导入需要 Python 3.11+（仅标准库）及本地 Open Herbology 药材数据：

```powershell
python scripts/import_book.py --book "Separated EPUBs/08 汤头歌诀白话解（第6版）.epub" --herbs "C:/Users/ASUS/projects/tcm-fangyao-app/src/data/raw-herbs.json"
```

正常使用已有 App 不需要 Open Herbology 源码目录。导出数据已经包含所需的药材匹配信息。

所有自动提取内容的状态均为待校对。古制剂量未换算；本 App 用于读书学习，不提供个人诊断或用药建议。网站按用户要求发布至 GitHub Pages，书籍再分发授权未独立核实。

收藏、笔记、熟记及最近阅读存在当前浏览器的 `tangtou-library-v1` 中。导入采用合并策略，同 ID 的现有笔记优先保留。清理浏览器数据会移除本地学习记录，请先导出备份。

## 验证

```powershell
npm test
python -m unittest discover -s tests -p "test_*.py"
npm run build
npx playwright test
```

浏览器测试默认使用本机 Microsoft Edge；可在 `playwright.config.ts` 更换浏览器通道。包含分类、组成与书源、检索、持久化、背诵、备份、手机布局和离线阅读检查。截图位于 `work/qa/`。
