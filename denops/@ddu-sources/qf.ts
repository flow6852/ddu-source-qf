import {
  BaseSource,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v2.2.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.2.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";
import { equal } from "https://deno.land/x/equal@v1.5.0/mod.ts";

type Params = {
  loc: boolean;
  what: What;
  isSubst: boolean;
  format: string;
};

type QuickFix = {
  id: number;
  items: QuickFixItem[];
  bufnr: number;
  col: number;
  lnum: number;
  title: string;
};

type QuickFixItem = {
  bufnr: number;
  col: number;
  lnum: number;
  text: string;
  type: string;
};

type What = {
  bufnr?: number;
  col?: number;
  id?: number;
  lnum?: number;
  title?: string;
  all?: number;
};

export class Source extends BaseSource<Params> {
  override kind = "file";

  override gather(args: {
    denops: Denops;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream<Item<ActionData>[]>({
      async start(controller) {
        // getlistid
        let titleid = 0;
        for (
          let i = (await (fn.getqflist(args.denops, {
            nr: "$",
            id: 0,
          })) as QuickFix).id as number;
          0 < i;
          i--
        ) {
          const what = await (args.sourceParams.loc
            ? fn.getloclist(args.denops, { id: i, all: 0 }, 0)
            : fn.getqflist(args.denops, { id: i, all: 0 })) as QuickFix;
          if (
            // isSubst filtering title string comming soon...?
            isContain(what, args.sourceParams)
          ) {
            titleid = i;
          }
        }

        if (titleid < 0) {
          controller.close();
        }

        const qflist = await (args.sourceParams.loc
          ? fn.getloclist(args.denops, { id: titleid, all: 0 }, 0)
          : fn.getqflist(args.denops, { id: titleid, all: 0 })) as QuickFix;
        // create items
        const items: Item<ActionData>[] = [];
        // format text
        const regexp = new RegExp(/(\s|\t|\n|\v)+/g);
        for (const citem of qflist.items) {
          const text: string = args.sourceParams.format.replaceAll(regexp, " ")
            .replaceAll(
              "%i",
              String(qflist.id),
            ).replaceAll(
              "%b",
              String(citem.bufnr),
            ).replaceAll(
              "%c",
              String(citem.col),
            ).replaceAll(
              "%l",
              String(citem.lnum),
            ).replaceAll(
              "%T",
              qflist.title,
            ).replaceAll(
              "%y",
              citem.type,
            ).replaceAll(
              "%t",
              citem.text,
            );

          items.push({
            word: text,
            action: {
              bufNr: citem.bufnr,
              col: citem.col,
              lineNr: citem.lnum,
              path: await fn.bufname(args.denops, citem.bufnr),
              text: text,
            },
          });
        }
        controller.enqueue(items);
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      loc: false,
      what: {},
      isSubst: false,
      format: "%T|%t",
    };
  }
}

function isContain(qf: QuickFix, src: Params) {
  let ret = true;
  for (const key of Object.keys(src.what)) {
    switch (key) {
      case "bufnr":
        ret = ret && (qf.bufnr == src.what.bufnr);
        break;
      case "col":
        ret = ret && (qf.col == src.what.col);
        break;
      case "id":
        ret = ret && (qf.id == src.what.id);
        break;
      case "lnum":
        ret = ret && (qf.lnum == src.what.lnum);
        break;
      case "title":
        ret = ret &&
          (src.isSubst
            ? (!qf.title.indexOf(src.what.title as string))
            : (qf.title == src.what.title));
        break;
    }
  }
  return ret;
}
