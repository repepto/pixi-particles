import { EditorController } from "../ui/EditorController";

export async function createApp(root: HTMLElement): Promise<void> {
    const controller = new EditorController(root);

    await controller.init();
}
