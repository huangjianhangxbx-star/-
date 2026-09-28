# 星骸回廊原型

本仓库存放《星骸回廊》的设计依据、已确认规则、原型源码和项目过程记录。

本机项目根目录：`E:\WORLDCREATOR\XingHaiHuiLang\Origin`。后续原型代码和项目记录都在此目录维护。

## 版本保存方式

- [GitHub 开发仓库](https://github.com/huangjianhangxbx-star/-)：保存开发中的提交，供网页端查看与协作；本地远端名为 `github`，`main` 默认跟踪 `github/main`。
- [Gitee 稳定仓库](https://gitee.com/huangjianhangxbx/xinghai-huilang-prototype)：保存确认可用的版本；本地远端名为 `gitee`，仅在决定更新稳定版时推送。仓库当前为私有。

日常提交后使用 `git push` 更新 GitHub。确定版本稳定后，使用 `git push gitee main` 更新 Gitee。两处都已完成首次上传；后续开发仍在本机上述项目根目录进行。

## 从哪里开始

- [口语版设计](计划/口语版设计.txt)：最直接表达的原始设计意图。
- [Three.js 原型实施计划](计划/从零搭建%20Three.js%20塔防战棋可验证原型计划.txt)：技术路线与阶段规划。
- [设计基线](docs/DesignBaseline.md)：合并后的规则基线。
- [尚待确认的规则](docs/OpenRules.md)：没有擅自当成已确认的事项。
- [项目术语与边界](CONTEXT.md) 与 [协作说明](AGENTS.md)：后续维护约定。
- [项目状态](记录/项目状态.md)：当前交付与设计决定索引；按日期的记录保存在 `记录/`。
- [运行原型](运行说明.md)：Windows 启动方法。

## 游戏原型

Three.js + TypeScript 原型位于 `game/`，包含源码、角色动画及特效资源、测试和锁定的 npm 依赖清单。安装 Node.js 22.12 或兼容版本后：

```powershell
cd game
npm ci
npm run dev
```

生产构建：`npm run build`。原型依赖 `game/public/assets/` 下的角色、动画和音效资源。

## 内容范围

仓库保留原始设计、规则演进记录、截图验证、角色原始资产、美术风格参考和视频参考。`work/`、依赖缓存、构建产物和本机服务日志不纳入版本管理。

角色及参考资产按用户现有项目保存。公开仓库或对外再分发前，请先核对每项素材的使用与再分发权利；本仓库不额外授予这些素材的许可。
