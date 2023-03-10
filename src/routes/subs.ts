import { NextFunction, Request, Response, Router } from "express";
import userMiddleware from "../middleware/user"
import authMiddleware from "../middleware/auth"
import { isEmpty } from "class-validator";
import Sub from "../entities/Sub/Sub";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User/User";
import Post from "../entities/Post/Post";
import multer, { FileFilterCallback } from "multer";
import { makeId } from "../utils/helpers";
import path from "path";
import { unlinkSync } from "fs";

const getSub = async (req: Request, res: Response) => {
    const name = req.params.name;
    try {
        const sub = await Sub.findOneByOrFail({ name });
        // 포스트를 생성한 후에 해당 sub에 속하는 포스트 정보들을 넣어주기
        const posts = await Post.find({
            where: { subName: sub.name },
            order: { createdAt: "DESC" },
            relations: ["comments", "votes"]
        })

        sub.posts = posts;

        if (res.locals.user) {
            sub.posts.forEach((p) => p.setUserVote(res.locals.user))
        }

        console.log("sub", sub)

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

const ownSub = async (req: Request, res: Response, next: NextFunction) => {
    const user: User = res.locals.user;
    try {
        const sub = await Sub.findOneOrFail({ where: { name: req.params.name } })
        if (sub.username !== user.username) {
            return res.status(403).json({ error: "이 커뮤니티를 소유하고 있지 않습니다." });
        }
        res.locals.sub = sub;
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "커뮤니티 소유 문제가 발생했습니다." })
    }
}

const upload = multer({
    storage: multer.diskStorage({
        destination: "public/images",
        filename: (req: Request, file, callback) => {
            const name = makeId(10);
            callback(null, name + path.extname(file.originalname));
        },
    }),
    fileFilter: (req: Request, file: any, callback: FileFilterCallback) => {
        if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
            callback(null, true);
        } else {
            callback(new Error("이미지 업로드 에러가 발생했습니다. 이미지가 아닙니다."))
        }
    }
})

const uploadSubImage = async (req: Request, res: Response) => {
    const sub: Sub = res.locals.sub;
    try {
        const type = req.body.type;

        // 파일 유형 지정치 않았을 시에는 업로드 된 파일 삭제
        if (type !== "image" && type !== "banner") {
            if (!req.file?.path) {
                return res.status(400).json({ error: "유효하지 않은 파일입니다." });
            }
            // 파일을 지워주기
            unlinkSync(req.file.path);
            return res.status(400).json({ error: "잘못된 파일 유형입니다." })
        }
        let oldImageUrn: string = "";
        if (type === "image") {
            // 사용중인 Urn을 저장합니다(이전 파일을 아래서 삭제하기 위해서)
            oldImageUrn = sub.imageUrn || "";
            // 새로운 파일 이름을 Urn으로 넣어줍니다.
            sub.imageUrn = req.file?.filename || "";
        } else if (type === "banner") {
            oldImageUrn = sub.bannerUrn || "";
            sub.bannerUrn = req.file?.filename || "";
        }
        await sub.save();

        // 사용하지 않는 이미지 삭제
        if (oldImageUrn !== "") {
            //데이터베이스는 파일 이름일 뿐이므로 개체 경로 접두사를 직접 추가해야 합니다.
            //Linux 및 Windows와 호환
            const fullFileName = path.resolve(
                process.cwd(),
                "public",
                "images",
                oldImageUrn
            );
            unlinkSync(fullFileName)
        }
        return res.json(sub)
    } catch (error) {
        console.log(error)
        return res.status(500).json({ error: "이미지 저장 문제가 발생했습니다." })
    }
}

const router = Router();

router.get("/:name", userMiddleware, getSub);
router.post("/", userMiddleware, authMiddleware, createSub);
router.get("/sub/topSubs", topSubs)
router.post("/:name/upload",
    userMiddleware,
    authMiddleware,
    ownSub,
    upload.single("file"),
    uploadSubImage)

export default router;