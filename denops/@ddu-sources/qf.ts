import {
  BaseSource,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v2.8.3/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.8.3/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.4.0/file.ts";
import {
  basename,
  isAbsolute,
} from "https://deno.land/std@0.184.0/path/mod.ts";

type Params = {
  nr: number;
  what: What;
  isSubst: boolean;
  dup: boolean;
  format: string;
  size: number;
  total: number;
};

type QuickFix = {
  id: number;
  items: QuickFixItem[];
  nr: number;
  qfbufnr: number;
  size: number;
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
  id?: number;
  nr?: number;
  qfbufnr?: number;
  size?: number;
  title?: string;
};

type BufInfo = {
  bufnr: number;
  listed: boolean;
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
        // get now bufNr
        // Note: fn.bufexists can't check """ hidden """
        const bufInfos = await fn.getbufinfo(args.denops) as Array<BufInfo>;

        let totalRemain = args.sourceParams.total;

        // getlistid
        let titleid = 0;
        for (
          let i = (await (args.sourceParams.nr > -1
            ? fn.getloclist(args.denops, args.sourceParams.nr, {
              nr: "$",
              id: 0,
            })
            : fn.getqflist(args.denops, {
              nr: "$",
              id: 0,
            })) as QuickFix).id as number;
          0 < i;
          i--
        ) {
          // default {what}
          // if use {all: 0}, `getqflist` get items
          const what: What = {
            id: i,
            nr: 0,
            qfbufnr: 0,
            title: "",
            size: 0,
          };

          const qfl = await (args.sourceParams.nr > -1
            ? fn.getloclist(args.denops, args.sourceParams.nr, what)
            : fn.getqflist(args.denops, what)) as QuickFix;
          if (
            isContain(qfl, args.sourceParams) && totalRemain > 0
          ) {
            titleid = i;

            const smaller = qfl.size < args.sourceParams.size
              ? qfl.size
              : args.sourceParams.size;

            const qflist = await (args.sourceParams.nr > -1
              ? args.denops.call(
                "ddu#source#qf#_getqflist",
                args.sourceParams.nr,
                {
                  id: titleid,
                  all: 0,
                },
                Math.min(smaller, totalRemain),
              )
              : args.denops.call("ddu#source#qf#_getqflist", {
                id: titleid,
                all: 0,
              }, Math.min(smaller, totalRemain))) as QuickFix;
            // create items
            const items: Item<ActionData>[] = [];
            for (const citem of qflist.items) {
              // fullpath
              // Note: fn don't have isabsolutepath
              const path =
                isAbsolute(await fn.bufname(args.denops, citem.bufnr))
                  ? await fn.bufname(args.denops, citem.bufnr)
                  : await fn.getcwd(args.denops) + "/" +
                    await fn.bufname(args.denops, citem.bufnr);

              // format text
              const regexp = new RegExp(/(\s|\t|\n|\v)+/g);
              const text: string = args.sourceParams.format.replaceAll(
                regexp,
                " ",
              )
                .replaceAll(
                  "%i",
                  String(qflist.id),
                ).replaceAll(
                  "%n",
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
                  "%b",
                  basename(await fn.bufname(args.denops, citem.bufnr)),
                ).replaceAll(
                  "%p",
                  await fn.bufname(args.denops, citem.bufnr),
                ).replaceAll(
                  "%P",
                  path,
                ).replaceAll(
                  "%t",
                  citem.text.replace(/^\s+/, ""),
                );

              // set action data
              let item: ActionData = {
                col: citem.col,
                lineNr: citem.lnum,
                path: path,
                text: text,
              };

              // set bufNr
              for (const info of bufInfos) {
                if (info.bufnr == citem.bufnr && info.listed) {
                  item = { ...item, ...{ bufNr: info.bufnr } };
                }
              }

              items.push({ word: text, action: item });
            }
            controller.enqueue(items);
            if (!args.sourceParams.dup) {
              break;
            }
            totalRemain = totalRemain - smaller;
          }
        }
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      nr: -1,
      what: {},
      isSubst: false,
      format: "%T|%t",
      dup: false,
      size: 10000,
      total: 10000,
    };
  }
}

function isContain(qf: QuickFix, src: Params) {
  let ret = true;
  for (const key of Object.keys(src.what)) {
    switch (key) {
      case "qfbufnr":
        ret = ret && (qf.qfbufnr == src.what.qfbufnr);
        break;
      case "nr":
        ret = ret && (qf.nr == src.what.nr);
        break;
      case "size":
        ret = ret && (qf.size == src.what.size);
        break;
      case "id":
        ret = ret && (qf.id == src.what.id);
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
