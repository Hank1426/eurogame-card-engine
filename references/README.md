# 参考项目

参考网站集中检出在此目录，每个项目保留自己的 Git 仓库。外部源码、图片和依赖不纳入本仓库，也不进入公开网页构建。

| 子目录 | 来源 | 用途 |
|---|---|---|
| `Next-Ark-Nova-Cards/` | https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards | 方舟卡牌、关键词、多语言描述与地图资料参考 |

在仓库根目录执行：

```powershell
git clone --depth 1 https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards.git references/Next-Ark-Nova-Cards
pnpm content:import
```

导入工具只静态解析数据，输出到被忽略的 `content/private/`，不执行参考项目代码、不安装其依赖，也不复制图片。上游快照和文件哈希保存在导入结果中。
