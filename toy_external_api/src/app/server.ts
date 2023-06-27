import console from "console";
export class Server {
  getRouteFromUrl(url: string) {
    console.log(`Request Url path is: ${url}`);
    return url
      ?.split("/")
      .slice(-1)
      .find((i) => i);
  }

  async verifyToy(
    toy?: string
  ): Promise<{ state: number; data: { name: string | undefined } }> {
    console.info("Calling external toy API");

    let state: number;
    const items = toy?.split("-");
    console.dir(items);
    if (items?.length === 2) {
      console.info("200 OK STATUS");
      state = 200;
    } else if (items?.length === 1 || (items && items?.length > 2)) {
      console.log("400 BAD REQUEST");
      state = 404;
    } else {
      console.log("500 server error occured.");
      throw new Error("Internal Server Error");
    }

    return Promise.resolve({
      state,
      data: { name: toy },
    });
  }
}
