# TOOL-009 P1/P2 实施结构

`desktop/workshop-v2-store.cjs` 提供项目 token 限定的 `listProjectDirectory`：只读取当前项目根目录，逐级 `lstat`，拒绝绝对、上级及链接目录。普通文件与受保护目录可见但不参与资产编辑；已登记原生资产根据其 `source` 显示缩略图与稳定 `assetId`。

`desktop/project-asset-browser.ts` 是项目页、模块编辑与试摆页共用的浏览器组件；`core/asset-browser-state.ts` 管理独立画布的路径、前进/后退、搜索、缩放、选中与最多四画布的分屏。组件状态写入 Electron profile 的 localStorage，不进入项目文档。左侧目录树按展开路径按需读取，右侧显示文件夹/文件/原生资产图卡；顶部标签右键支持新建、复制、向右或向下分屏、关闭。图标为自有 SVG，随 EXE 打包。

试摆页沿用现有 `AssemblyView.dropPosition` 的地面射线和 `snapInstancePosition` 的 0.25 m Root 相位规则。浏览器图卡仅对已登记原生资产设置拖放数据；视口显示目标网格十字提示，释放时给当前场景增加一个引用原 `assetId` 的实例，一次历史操作；公共库拖入路径保持原有复制逻辑。
