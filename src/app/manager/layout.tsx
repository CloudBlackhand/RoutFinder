import ManagerShell from "./shell";

export default function ManagerLayout({ children }: LayoutProps<"/manager">) {
  return <ManagerShell>{children}</ManagerShell>;
}
