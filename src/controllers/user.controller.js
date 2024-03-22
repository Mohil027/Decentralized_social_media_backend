import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user  = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // I will keep access token as it is till it expires but I will store the refresh token in the database till it expires
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
         
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
        
    }

}



const registerUser = asyncHandler( async (req, res) => {
    // get user details from the frontend (using postman for now)
    // validation to check fields are not empty
    // check if user already exists
    // check for images, and avatar
    // upload them to cloudinary, check if avatar uploaded to multer
    // user object for mongodb - create entry in db (.create)
    // remove password and refresh token field from response
    // check for user creation
    // return response


    const {fullName, email, username, password } = req.body
    console.log("email : ", email);

    // if (fullName === ""){
    //     throw new ApiError(400, "fullname is required")
    // }
    if (
        [fullName, email, username, password].some((field) => 
        field?.trim() === "")

    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar File is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar){
        throw new ApiError(400, "Avatar File is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering User")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )

})
const loginUser = asyncHandler( async (req, res) => {
    // Take email/username and password from the user
    // check if the username exists, if yes match entered password with the password associated with the username
    // if username/email does not exist throw api error that user does not exist and redirect to the register page
    // a forgot password functionality but i do not need to implement it right now
    // if password matches generate and assign accesstoken and refresh token with different expiry time to the user login successful otherwise login fails
    // send token as cookies
    const { username, email, password } = req.body 
    if (!(username || email)){
        throw new ApiError(400, "username or email is required!")
    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    })
    if (!user) {
        throw new ApiError(404, "Username or email does not exist, please register if new user")
    }
    const isPasswordvalid = await user.isPasswordCorrect(password)
    if (!isPasswordvalid) {
        throw new ApiError(401, "The user credentials are invalid")

    }
    // if all correct generate both the access and refresh tokens
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //sending cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
            user: loggedInUser, accessToken,
            refreshToken
        },
        "User logged in successfully"
        ),
    )
    


})
const logoutUser = asyncHandler(async(req, res) => {
    // clearing cookies
    // resetting refreshToken
    if(req.user){
        console.log("Yes")
    }
    await User.findByIdAndUpdate(
        
        req.user._id, 
        {
            $set:{
                refreshToken: null
            }

        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(new ApiResponse(200, {}, "User Logged out successfully"))


})


export {
    registerUser,
    loginUser,
    logoutUser
}