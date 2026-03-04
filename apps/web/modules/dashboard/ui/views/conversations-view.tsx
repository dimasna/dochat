import Image from "next/image";

export const ConversationsView = () => {
  return (
    <div className="flex h-full flex-1 flex-col gap-y-4 bg-muted">
      <div className="flex flex-1 items-center justify-center gap-x-2">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          D
        </div>
        <p className="font-semibold text-lg">Dochat</p>
      </div>
    </div>
  );
};
