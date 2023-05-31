import { expect } from "chai";

import PrintMessage from "../pages/print";

import { Given, Then, When } from "@cucumber/cucumber";

Given("I know my Java Script", function () {
  this.printMessage = new PrintMessage();
  this.printMessage.messagePrint("I know JAVA SCRIPT");
});

When("I wrote the code to print hello world", function () {
  this.message = "hello world";
  this.printMessage.messagePrint(this.message);
});

Then("hello world is printed", function () {
  expect(this.message).equal("hello world");
});
