import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import BaseEntity from "../Entity";
import { User } from "../User/User";
import { Expose } from "class-transformer";
import Post from "../Post/Post";

@Entity("subs")
export default class Sub extends BaseEntity {

    @Index()
    @Column({ unique: true })
    name: string

    @Column()
    title: string

    @Column({ type: 'text', nullable: true })
    description: string

    @Column({ nullable: true })
    imageUrn: string

    @Column({ nullable: true })
    bannerUrn: string

    @Column()
    username: string

    @ManyToOne(() => User)
    @JoinColumn({ name: "username", referencedColumnName: "username" })
    user: User;

    @OneToMany(() => Post, (post) => post.sub)
    posts: Post[]

    @Expose()
    get imageUrl(): string | undefined {
        return this.imageUrn ? `${process.env.APP_URL}/images/${this.imageUrn}` :
            "https://www.gravatar.com/avatar?d=mp&f=y"
    }

    @Expose()
    get bannerUrl(): string | undefined {
        return this.bannerUrn ? `${process.env.APP_URL}/images/${this.bannerUrn}` :
            undefined;
    }
}