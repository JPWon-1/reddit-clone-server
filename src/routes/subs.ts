import { NextFunction, Request, Response, Router } from "express";
import userMiddleware from "../middleware/user"
import authMiddleware from "../middleware/auth"
import { isEmpty } from "class-validator";
import Sub from "../entities/Sub/Sub";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User/User";

const createSub = async (req: Request, res: Response, next: NextFunction) => {
    const { name, title, description } = req.body;

    console.log("sub route log", name, title, description)

    try {
        let errors: any = {};
        if (isEmpty(name)) errors.name = "이름은 비워둘 수 없습니다."
        if (isEmpty(title)) errors.name = "제목은 비워둘 수 없습니다."

        const sub = await AppDataSource.manager
            .getRepository(Sub)
            .createQueryBuilder("sub")
            .where("lower(sub.name) = :name", { name: name.toLowerCase() })
            .getOne();

        if (sub) errors.name = "서브가 이미 존재합니다.";
        if (Object.keys(errors).length > 0) {
            throw errors;
        }
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: "sub 생성 문제가 발생했습니다." })
    }

    try {
        const user: User = res.locals.user;
        const sub = new Sub();
        sub.name = name;
        sub.description = description;
        sub.title = title;
        sub.user = user;
        await sub.save();
        return res.json(sub);
    } catch (error) {
        console.error(error)
        return res.status(500).json({error : "sub 저장중에 문제가 발생했습니다."})
    }
}


const router = Router();

router.post("/", userMiddleware, authMiddleware, createSub);

export default router;