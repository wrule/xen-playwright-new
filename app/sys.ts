
class Sys {
  public constructor(
    private variables: any = { },
    private envVariables: any = { },
  ) { }

  public set(key: any, value: any) {
    this.variables[key] = value;
  }

  public get(key: any) {
    return this.variables[key];
  }

  public setEnvVariable(key: any, value: any) {
    this.envVariables[key] = value;
  }

  public getEnvVariable(key: any) {
    return this.envVariables[key];
  }

  public states() {
    return { variables: this.variables, envVariables: this.envVariables };
  }

  public sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  public exec() {
    throw new Error('外部脚本模块后续有整体改版，固playwright脚本内暂不支持使用外部脚本。');
  }
}
