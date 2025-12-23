interface DirPath {
    baseDir: string,
    frontendDir: string,
    backendDir: string
}

type CloneSuccess = {
    projectId:string,
    dirPath: DirPath,
    cloneSkipped?: false;
}

type CloneSkipped = {
    cloneSkipped: true;
}

type CloneResult = CloneSuccess | CloneSkipped;

export { CloneSkipped, CloneSuccess, CloneResult };