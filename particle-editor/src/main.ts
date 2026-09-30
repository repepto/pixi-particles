import "./styles.css";
import { createApp } from "./app/App";
import { getById } from "./utils/dom";

void createApp(getById("app"));
