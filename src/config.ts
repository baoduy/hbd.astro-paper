export const SITE = {
  website: "https://drunkcoding.net/",
  author: "Steven (Hoang Bao Duy)",
  profile: "https://drunkcoding.net/",
  desc: "Drunkcoding.net is a blog page from Steven Hoang, a highly experienced professional with extensive knowledge in technology and software development.",
  title: "drunkcoding.net",
  ogImage: "favicon.svg",
  lightAndDarkMode: true,
  postPerIndex: 5,
  postPerPage: 10,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: false,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Bangkok", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
