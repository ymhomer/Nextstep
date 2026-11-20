import { lazy, Suspense, type ComponentType } from "react";

export default function dynamic<P extends object>(
  load: () => Promise<ComponentType<P> | { default: ComponentType<P> }>,
  options?: { loading?: ComponentType; ssr?: boolean },
) {
  const Component = lazy(async () => {
    const module = await load();
    return typeof module === "object" && "default" in module ? module : { default: module };
  });
  const Loading = options?.loading;
  return function DynamicComponent(props: P) {
    return <Suspense fallback={Loading ? <Loading /> : null}><Component {...props} /></Suspense>;
  };
}
