/**
 * 关于页 Markdown 渲染版本号。
 *
 * 当 markdown 渲染管线发生变更（如升级 Shiki、修改高亮主题、
 * 调整 marked 配置等）时，递增此版本号即可触发所有已缓存内容
 * 的懒加载重新渲染，无需手动操作或额外的迁移脚本。
 */
export const ABOUT_RENDER_VERSION = "v1";
