interface FileSystemHandlePermissionDescriptor {
    mode?: "read" | "readwrite";
}

interface FileSystemHandle {
    readonly kind: "file" | "directory";
    readonly name: string;
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: "file";
    getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: "directory";
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

interface Window {
    showDirectoryPicker(options?: { id?: string; mode?: "read" | "readwrite"; startIn?: string | FileSystemHandle }): Promise<FileSystemDirectoryHandle>;
}
