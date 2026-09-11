"use client";

import { parseSpec } from "@/lib/nova/spec";
import type { NovaWindow } from "@/lib/nova/types";
import About from "./apps/About";
import Calc from "./apps/Calc";
import Clock from "./apps/Clock";
import Files from "./apps/Files";
import Paint from "./apps/Paint";
import Guard from "./apps/Guard";
import Monitor from "./apps/Monitor";
import Notes from "./apps/Notes";
import Oracle from "./apps/Oracle";
import Rules from "./apps/Rules";
import Settings from "./apps/Settings";
import ShellApp from "./apps/ShellApp";
import Studio from "./apps/Studio";
import Timeline from "./apps/Timeline";
import { useNova } from "./kernel-context";
import SpecRenderer from "./SpecRenderer";

/** موزّع محتوى النوافذ: تطبيق مثبّت، أو تطبيق مولّد يُرسم بمفسّر المواصفات. */
export default function AppHost({ win }: { win: NovaWindow }) {
  const { state } = useNova();

  switch (win.app) {
    case "oracle":
      return <Oracle />;
    case "calc":
      return <Calc win={win} />;
    case "clock":
      return <Clock win={win} />;
    case "paint":
      return <Paint />;
    case "about":
      return <About />;
    case "files":
      return <Files win={win} />;
    case "shell":
      return <ShellApp />;
    case "notes":
      return <Notes win={win} />;
    case "studio":
      return <Studio />;
    case "monitor":
      return <Monitor />;
    case "timeline":
      return <Timeline />;
    case "rules":
      return <Rules />;
    case "guard":
      return <Guard />;
    case "settings":
      return <Settings />;
    default: {
      const made = state.composed.find((c) => c.id === win.app);
      const spec = made ? parseSpec(made.spec) : null;
      if (spec) return <SpecRenderer spec={spec} appId={win.app} />;
      return (
        <div className="empty">
          <div style={{ fontSize: 24 }}>◌</div>
          <div>هذا التطبيق لم يعد موجودًا</div>
          <div className="faint" style={{ fontSize: 12 }}>
            ربما أُرجع النظام بالزمن إلى ما قبل توليده.
          </div>
        </div>
      );
    }
  }
}
