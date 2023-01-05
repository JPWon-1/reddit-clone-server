import express from "express";
import morgan from "morgan";
import { AppDataSource } from "./data-source";

const app = express();

app.use(express.json());
app.use(morgan('dev'));

app.get("/", (_, res) => res.send('running'));

let port = 4000;
app.listen(port, async() => {
    console.log(`server running at http://localhost:4000`)

    AppDataSource.initialize().then(() => {
        console.log('dtabase initialized')
    }).catch(err => console.log(err))

})