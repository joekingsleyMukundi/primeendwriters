// jshint esversion:8
const crypto = require('crypto');
const User = require('../models/writter');
const { sendMail } = require('../utils/sendemail.js');
const Password = require('../utils/password');
const Job = require('../models/jobs');
const { clearCache } = require('ejs');

// @desc          register user
// @route         Get /api/v1/auth/register
// @access         public

exports.registeruser = async(req,res,next)=>{
  if(req.session.user){
    res.redirect('/dashboard')
  }
  if(req.method == 'POST'){
    const{username,email,phone,password,repassword} = req.body;
    if(password != repassword){
      req.flash('error', 'Password should match');
      return res.redirect('/register');
    }
    const user = await User.findOne({phone:phone});
    console.log(user);
    if(user){
      req.flash('error', 'Phone already exists');
      return res.redirect('/register');
    }
    User.findOne({email:email})
    .then(userDocs=>{
      if(userDocs){
        req.flash('error', 'Email already exists');
        return res.redirect('/register');
      }
      const user = new User({username:username,email:email,password:password,phone:phone,});
      return user.save()
      .then(newuser=>{
        req.flash('success', 'Registration successful. wait for approval and  login');
        return res.redirect('/login');
      });
    })
    .catch(error=>{
      console.log(error);
      req.flash('error', 'Error occured plese contact admin');
      return res.redirect('/register');
    });
  }else{
    res.render('signup',{message:req.flash('error')})
  }
};

exports.loginuser = async(req,res,next)=>{
  if(req.session.user){
    console.log(req.session.user);
    return res.redirect('/')
  }
  if(req.method == 'POST'){
    const{email, password} = req.body;
    const existinguser = await User.findOne({email});
    if(!existinguser){
      req.flash('error', 'User does not exist');
      return res.redirect('/register')
    }
    const matchpassword = await  Password.compare(existinguser.password, password);
    if(!matchpassword){
      req.flash('error', 'Wrong password');
      return res.redirect('/login')
    }
    if(!existinguser.verified){
      req.flash('error', 'User is not verified');
      return res.redirect('/login')
    }
      req.session.user = existinguser;
      req.session.is_loggedin=true;
      return res.redirect('/')
  }else{
    res.render('login', {successmessage:req.flash('success'),errormessage:req.flash('error')})
  }
  
};


exports.logout=(req,res,next)=>{
  console.log('hey');
  req.session.destroy(function(err) {
    if(err) {
        return next(err);
    } else {
        req.session = null;
        console.log(req.session);
        console.log("logout successful");
        return res.redirect('/');
    }
});
};

// exports.forgotpass = async (req,res,next)=>{
//   if(req.session.user){
//     res.redirect('/dashboard')
//   }
//   if(req.method == 'POST'){
//     const user = await User.findOne({email:req.body.email});
//     if(!user){
//       req.flash('error', 'User does not exist');
//       return res.redirect('/register');
//     }

//     const resetToken = user.getResetPasswordToken();
//     console.log(resetToken);
//     const reseturl = `${req.protocol}://${req.get('host')}/resetpassword/${resetToken}`;
//     const message  = `You are receiving this email because you (or someone else) has requested a reset of password. Please click this link ${reseturl}`;
//     const subj = "Password Renewal";
//     try {
//       await sendMail(user.firstname,user.email,subj,message);
//       res.redirect('/forgotpassword')
//     } catch (error) {
//       console.log(error);
//       user.resetPasswordToken = undefined;
//       user.resetPassworExpire = undefined;
//       await user.save({validateBeforeSave: false});
//       res.redirect('/forgotpassword')
//     }
//     await user.save(
//       {
//         validateBeforeSave: false
//       }
//     );
//   }
//   res.render('forgotpassword')
// };

// exports.resetPassword = async (req,res,next)=>{
//   // get hashed token
//   const resetpassToken  = crypto.createHash('sha256').update(req.params.resettoken).digest('hex');
//   const user = await User.findOne({
//     resetPasswordToken : resetpassToken,
//     resetPassworExpire :{$gt : Date.now()}
//   });

//   if(!user){
//     req.flash('error', 'User does not exist');
//     res.redirect('/login')
//   }
//   res.render('')
//   if(req.method == 'POST'){
//     // set new pass
//     user.password = req.body.password;
//     user.resetPasswordToken = undefined;
//     user.resetPassworExpire= undefined;
//     await user.save();
//     req.session.user = user;
//     req.session.is_loggedin = true
//     res.redirect('/dashboard')
//   }
// };

exports.dashboard=async (req,res,next)=>{
  const user=req.session.user;
  if(user.role=="admin"){
    return res.redirect('/admindashboard');
  }
  const currentuser = await User.findOne({email:user.email});
  var jobsno;
  var pendingjobs;
  const totalJobs = await Job.find({writerid:user._id});
  if(!totalJobs){
    jobsno = 0;
    pendingjobs=0;
  }else{
    jobsno= totalJobs.length;
    pendingjobs = await Job.find({writerid:user._id,status:'pending'});
    approvedJobs = await Job.find({writerid:user._id,status:'paid'});
    rejectedjobs = await Job.find({writerid:user._id,status:'rejected'});
  }
  console.log(user);
  context={
    user:currentuser,
    totaljobs:jobsno,
    pendingjobs:pendingjobs.length,
    jobs:totalJobs,
    paidjobs:approvedJobs.length,
    rejectedjobs:rejectedjobs.length,
    errormessage:req.flash('error'),
    successmessage:req.flash('success')
  };
  res.render('dashboard',context);
};

exports.jobs= async(req,res,next)=>{
  const user=req.session.user;
  const totalJobs = await Job.find({writerid:user.__id});
  context={
    user:user,
    jobs:totalJobs
  };
  if(req.method == 'POST'){
    const title = req.body.title;
    const platform = req.body.platform;
    const amount =Number(req.body.amount);
    const job = new Job({jobTitle:title,writerid:user._id,amount:amount,platform:platform,writerUsername:user.username,writeremail:user.email,writerphone:user.phone});
    job.save()
    .then(results=>{
      req.flash('success', 'Job upload successful. Please wait for validation');
      return res.redirect('/');
    })
    .catch(error=>{
      console.log(error);
      req.flash('Error', 'Job upload successful. Please wait for validation');
      return res.redirect('/');
    });
  }else{
    res.redirect('/');
  }
  
};


exports.editJob = async(req,res,next)=>{
  const user =  req.session.user
  const id = req.params.id;
  const job = await Job.findById(id);
  if(req.method == 'POST'){
    const question  =  req.body.title;
    const  amount =  req.body.amount;
    const platform = req.body.platform;
    job.jobTitle = question
    job.amount = amount
    job.platform = platform
    job.save()
    console.log(job)
    return res.redirect('/');
  }else{
    return res.render('editjob',{
      user:user,
      job:job,
      errormessage:req.flash('error'),
      successmessage:req.flash('success')});
  }
};
