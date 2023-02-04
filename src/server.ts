import express from "express";
import morgan from "morgan";
import { AppDataSource } from "./data-source";
import authRoutes from './routes/auth';
import cors from 'cors';
import dotenv from 'dotenv';

const app = express();
const origin = "http://localhost:3000";
app.use(cors({
    origin,
    credentials: true
}))
app.use(express.json());
app.use(morgan('dev'));

dotenv.config()

app.get("/", (_, res) => res.send('running'));
app.use("/api/auth", authRoutes);

const port = 4000;
app.listen(port, async() => {
    console.log(`server running at http://localhost:4000`)

    AppDataSource.initialize().then(() => {
        console.log('database initialized')
    }).catch(err => console.log(err))
})