export class BuildJobError extends Error{
    public payload : any;
    constructor(message: string, payload: any){ 
        super(message);
        this.message = "CloneJobError";
        this.payload = payload;
    }
}