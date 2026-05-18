declare module "@testing-library/react" {
  export * from "@testing-library/dom";
  export const act: (...args: any[]) => any;
  export const fireEvent: any;
  export const render: (...args: any[]) => any;
  export const screen: any;
  export const waitFor: (...args: any[]) => Promise<any>;
  export const within: (element: Element) => any;
}

declare module "@testing-library/user-event" {
  const userEvent: {
    setup: (...args: any[]) => any;
  };

  export default userEvent;
}
