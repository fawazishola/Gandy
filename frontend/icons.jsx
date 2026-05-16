/* global React */
const { createElement: h } = React;

// Tiny icon set — stroked, 1.5px, 16px viewBox unless noted
const Icon = ({ d, size = 14, sw = 1.5, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const IconBell = (p) => <Icon {...p} d="M3.5 11.5h9M5 11.5V7a3 3 0 0 1 6 0v4.5M7 13.5a1 1 0 0 0 2 0" />;
const IconSearch = (p) => <Icon {...p} d="M11.5 11.5 14 14M3 7.5a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0Z" />;
const IconChevDown = (p) => <Icon {...p} d="M4 6l4 4 4-4" />;
const IconChevRight = (p) => <Icon {...p} d="M6 4l4 4-4 4" />;
const IconHome = (p) => <Icon {...p} d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5h-3v-4h-4v4H3a.5.5 0 0 1-.5-.5V7.5Z" />;
const IconRepo = (p) => <Icon {...p} d="M3.5 2.5h7a1 1 0 0 1 1 1V13l-2-1.5-2 1.5-2-1.5-2 1.5V3.5a1 1 0 0 1 1-1Z" />;
const IconReport = (p) => <Icon {...p} d="M4 2.5h6l2 2V13a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 13V2.5ZM6 7h4M6 9.5h4M6 11.5h2.5" />;
const IconCog = (p) => <Icon {...p} d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0-3v1.5M8 12v1.5M2.5 8H4m8 0h1.5M4.2 4.2l1 1m5.6 5.6 1 1M4.2 11.8l1-1m5.6-5.6 1-1" />;
const IconPlus = (p) => <Icon {...p} d="M8 3v10M3 8h10" />;
const IconBranch = (p) => <Icon {...p} d="M4.5 3v10M4.5 13a2.5 2.5 0 0 1 2.5-2.5h2A2.5 2.5 0 0 0 11.5 8V3M4.5 3a1.25 1.25 0 1 0 0 .01M4.5 13a1.25 1.25 0 1 0 0 .01M11.5 3a1.25 1.25 0 1 0 0 .01" />;
const IconCheck = (p) => <Icon {...p} d="M3 8.5 6.5 12 13 4.5" />;
const IconX = (p) => <Icon {...p} d="M4 4l8 8M12 4l-8 8" />;
const IconPlay = (p) => <Icon size={p.size||12} sw={0} fill="currentColor" d="M4 3v10l9-5Z" />;
const IconArrow = (p) => <Icon {...p} d="M3 8h10M9 4l4 4-4 4" />;
const IconDownload = (p) => <Icon {...p} d="M8 2v8m0 0 3-3m-3 3-3-3M3 13h10" />;
const IconExt = (p) => <Icon {...p} d="M6 3H3v10h10v-3M9 3h4v4M13 3 7.5 8.5" />;
const IconBob = (p) => (
  <Icon {...p} d={
    <g>
      <path d="M3 5.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H8.5L6 12.5V10.5H5a2 2 0 0 1-2-2v-3Z" />
      <circle cx="6" cy="7" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r="0.7" fill="currentColor" stroke="none" />
    </g>
  } />
);
const IconGit = (p) => <Icon {...p} d="M11.5 4.5 4.5 11.5M11.5 4.5h-3M11.5 4.5v3M4.5 11.5h3M4.5 11.5v-3" />;
const IconShield = (p) => <Icon {...p} d="M8 2 3 4v4c0 2.5 2 4.5 5 5.5 3-1 5-3 5-5.5V4L8 2ZM6 8l1.5 1.5L10.5 6.5" />;
const IconDots = (p) => <Icon {...p} d="M3.5 8h.01M8 8h.01M12.5 8h.01" sw={2} />;
const IconSettings = (p) => <Icon {...p} d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0-3v1.5M8 12v1.5M2.5 8H4m8 0h1.5M4.2 4.2l1 1m5.6 5.6 1 1M4.2 11.8l1-1m5.6-5.6 1-1" />;
const IconTrash = (p) => <Icon {...p} d="M3 5h10M5 5V3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V5M6.5 7.5v4M9.5 7.5v4M4.5 5v7.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V5" />;
const IconFilter = (p) => <Icon {...p} d="M2 3h12L9.5 8v4.5L6.5 14V8L2 3Z" />;
const IconEye = (p) => <Icon {...p} d="M1.5 8s2-4 6.5-4 6.5 4 6.5 4-2 4-6.5 4S1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />;
const IconUsers = (p) => <Icon {...p} d="M5.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10.5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2 13v-1.5a2.5 2.5 0 0 1 2.5-2.5h2a2.5 2.5 0 0 1 2.5 2.5V13M9 13v-1.5a2.5 2.5 0 0 1 2.5-2.5h2a2.5 2.5 0 0 1 2.5 2.5V13" />;
const IconKey = (p) => <Icon {...p} d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5.5 7.5 2 11M2 11h2M2 11v2" />;
const IconCreditCard = (p) => <Icon {...p} d="M2 5.5h12M2 4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7ZM4 9.5h3" />;
const IconCopy = (p) => <Icon {...p} d="M5.5 5.5V3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-2.5M3 6.5h7a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V7a.5.5 0 0 1 .5-.5Z" />;
const IconGitHub = (p) => <Icon {...p} d="M8 2a6 6 0 0 0-1.9 11.7c.3 0 .4-.1.4-.3v-1c-1.7.4-2-.8-2-.8-.3-.7-.7-.9-.7-.9-.5-.4 0-.4 0-.4.6 0 1 .6 1 .6.5.9 1.4.6 1.7.5 0-.4.2-.7.4-.8-1.3-.2-2.7-.7-2.7-3 0-.7.2-1.2.6-1.6 0-.2-.3-.8.1-1.7 0 0 .5-.2 1.6.6.5-.1 1-.2 1.5-.2s1 .1 1.5.2c1.1-.8 1.6-.6 1.6-.6.4.9.1 1.5.1 1.7.4.4.6.9.6 1.6 0 2.3-1.4 2.8-2.7 3 .2.2.4.5.4 1v1.5c0 .2.1.3.4.3A6 6 0 0 0 8 2Z" />;

Object.assign(window, {
  Icon, IconBell, IconSearch, IconChevDown, IconChevRight,
  IconHome, IconRepo, IconReport, IconCog, IconPlus, IconBranch,
  IconCheck, IconX, IconPlay, IconArrow, IconDownload, IconExt,
  IconBob, IconGit, IconShield, IconDots, IconSettings, IconTrash,
  IconFilter, IconEye, IconUsers, IconKey, IconCreditCard, IconCopy, IconGitHub
});
