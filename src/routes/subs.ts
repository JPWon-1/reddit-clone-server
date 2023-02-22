import { NextFunction, Request, Response, Router } from "express";
import userMiddleware from "../middleware/user"
import authMiddleware from "../middleware/auth"
import { isEmpty } from "class-validator";
import Sub from "../entities/Sub/Sub";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User/User";
import Post from "../entities/Post/Post";

const getSub = async (req: Request, res: Response) => {
    const name = req.params.name;
    try {
        const sub = await Sub.findOneByOrFail({ name });

        // 포스트를 생성한 후에 해당 sub에 속하는 포스트 정보들을 넣어주기
        return res.json(sub);
    } catch (error) {
        return res.status(404).json({ error: "커뮤니티를 찾을 수 없음" });
    }
}

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
        return res.status(500).json({ error: "sub 저장중에 문제가 발생했습니다." })
    }
}

const topSubs = async (req: Request, res: Response) => {
    try {
        const imageUrlExp = `COALESCE('${process.env.APP_URL}/images/' || s."imageUrn",
            'https://www.gravatar.com/avatar?d=mp&f=y')`;
        const subs = await AppDataSource
            .createQueryBuilder()
            .select(
                `s.title, s.name, ${imageUrlExp} as "imageUrl", count(p.id) as "postCount"`
            )
            .from(Sub, "s")
            .leftJoin(Post, "p", `s.name = p."subName"`)
            .groupBy('s.title, s.name, "imageUrl"')
            .orderBy(`"postCount"`, "DESC")
            .limit(5)
            .execute();
        return res.json(subs);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "loading topsub went wrong" })
    }
}

const router = Router();

router.get("/:name", userMiddleware, getSub);
router.post("/", userMiddleware, authMiddleware, createSub);
router.get("/sub/topSubs", topSubs)

export default router;