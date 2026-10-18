/* Marshal Fitness — holiday dates (version 21). Used by holidays.js (website) and admin21.js.
   Fixed days: [month, first day, last day].
   Moon days: first day of each year (Umm al-Qura calendar). After 2032 the phone's own
   Islamic calendar is used. Admin can move the moon days by 1 day. */
window.MF_HOLIDAY_DATES = {
  order: ["flag", "ramadan", "women", "fitr", "nowruz", "mother", "adha", "children", "father", "mawlid"],
  names: {
    flag: "Kurdistan Flag Day", ramadan: "Ramadan", women: "Women's Day", fitr: "Eid al-Fitr", nowruz: "Nowruz",
    mother: "Mother's Day", adha: "Eid al-Adha", children: "Children's Day", father: "Father's Day", mawlid: "Prophet's Birthday"
  },
  fixed: { flag: [12, 17, 17], women: [3, 8, 8], nowruz: [3, 18, 24], mother: [3, 21, 21], children: [6, 1, 1], father: [6, 21, 21] },
  moon: {
    ramadan: ["2026-02-18", "2027-02-08", "2028-01-28", "2029-01-16", "2030-01-05", "2030-12-26", "2031-12-16", "2032-12-04"],
    fitr: ["2026-03-20", "2027-03-09", "2028-02-26", "2029-02-14", "2030-02-04", "2031-01-24", "2032-01-14"],
    adha: ["2026-05-27", "2027-05-16", "2028-05-05", "2029-04-24", "2030-04-13", "2031-04-02", "2032-03-22"],
    mawlid: ["2026-08-25", "2027-08-14", "2028-08-03", "2029-07-24", "2030-07-13", "2031-07-02", "2032-06-20"]
  },
  length: { fitr: 3, adha: 4, mawlid: 1 }
};
