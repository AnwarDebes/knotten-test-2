/** Every photo on the site, with who took it and the licence. */
export type Photo = {
  src: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
  credit: string;
  license: string;
  url?: string;
};

export const PHOTOS: Record<string, Photo> = {
  view: {
    src: "/img/view.jpg",
    w: 1440,
    h: 1440,
    alt: "Utsikten fra Knotten mot Sniksfjorden og havet, fotografert fra nabotomten",
    caption: "Utsikten mot Sniksfjorden og havet, fotografert fra nabotomten som ligger litt lavere enn feltet",
    credit: "Sigve Simonsen AS",
    license: "Prosjektets eget bilde",
  },
  view2: {
    src: "/img/view-2.jpg",
    w: 1331,
    h: 1331,
    alt: "Utsikten fra Knotten mot Sniksfjorden, med gårdstunet og elva nedenfor",
    caption: "Det samme utsiktsbildet i et annet utsnitt, med gårdstunet, veien og elva nedenfor",
    credit: "Sigve Simonsen AS",
    license: "Prosjektets eget bilde",
  },
  sniksfjorden: {
    src: "/img/commons-sniksfjorden.jpg",
    w: 1600,
    h: 1067,
    alt: "Sniksfjorden sett fra høyden ved Snig, ut mot havet",
    caption: "Sniksfjorden sett fra høyden ved Snig, med åpent hav i enden av fjorden",
    credit: "Rolfsteinar, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Sniksfjorden-20091018.jpg",
  },
  snig: {
    src: "/img/commons-snig.jpg",
    w: 2200,
    h: 1179,
    alt: "Snig ved Sniksfjorden, der Audna renner ut",
    caption: "Snig ved Sniksfjorden, der Audna renner ut i fjorden",
    credit: "Bjoertvedt, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Lindesnes_Snig_IMG_1118.JPG",
  },
  vigeland: {
    src: "/img/commons-vigeland-floyheia.jpg",
    w: 2200,
    h: 1467,
    alt: "Vigeland sett fra Fløyheia, med Audna gjennom sentrum",
    caption: "Vigeland sett fra Fløyheia, med Audna gjennom sentrum",
    credit: "Rolfsteinar, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:130310-1601_-_Vigeland_i_Lindesnes_kommune,_fra_Fl%C3%B8yheia.jpg",
  },
  spangereid: {
    src: "/img/commons-spangereid.jpg",
    w: 2200,
    h: 1465,
    alt: "Spangereid sett fra lufta, med fjorden, stranda og kanalen",
    caption: "Spangereid fra lufta, vest for Knotten langs fylkesvei 460",
    credit: "Flums, Wikimedia Commons",
    license: "CC BY-SA 4.0",
    url: "https://commons.wikimedia.org/wiki/File:Spangereid_fra_lufta.jpg",
  },
  audna: {
    src: "/img/commons-audna-outlet.jpg",
    w: 2200,
    h: 875,
    alt: "Audnas utløp, naturreservat",
    caption: "Audnas utløp, naturreservat",
    credit: "Bjoertvedt, Wikimedia Commons",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Lindesnes_Audna_outlet_IMG_1342_nature_reserve.JPG",
  },
};
