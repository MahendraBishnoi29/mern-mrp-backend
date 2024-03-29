const cloudinary = require("../utils/cloud");
const Movie = require("../models/movie");
const { isValidObjectId } = require("mongoose");
const {
  formatActor,
  relatedMovieAggregation,
  getAverageRatings,
  topRatedMoviesPipeline,
} = require("../utils/helper");

// UPLOAD TRAILER FUNCTION
const uploadTrailer = async (req, res) => {
  const { file } = req;

  if (!file) return res.json({ error: "Video file is missing!" });

  const { secure_url: url, public_id } = await cloudinary.v2.uploader.upload(
    file?.path,
    {
      resource_type: "video",
    }
  );

  res.status(201).json({ url, public_id });
};

// CREATE MOVIE FUNCTION
const createMovie = async (req, res) => {
  const { file, body } = req;

  const {
    title,
    storyLine,
    director,
    releaseDate,
    status,
    type,
    genres,
    tags,
    cast,
    writers,
    trailer,
    language,
  } = body;

  const newMovie = new Movie({
    title,
    storyLine,
    releaseDate,
    status,
    type,
    genres,
    tags,
    cast,
    trailer,
    language,
  });

  if (director) {
    if (!isValidObjectId(director))
      return res.json({ error: "Invalid Director Id" });
    newMovie.director = director;
  }

  if (writers) {
    for (let w of writers) {
      if (!isValidObjectId(w)) return res.json({ error: "Invalid Writer Id" });
    }
    newMovie.writers = writers;
  }

  // uploading Poster
  if (file) {
    const {
      public_id,
      secure_url: url,
      responsive_breakpoints,
    } = await cloudinary.v2.uploader.upload(file?.path, {
      transformation: { width: 1280, height: 720 },
      responsive_breakpoints: {
        create_derived: true,
        max_width: 640,
        max_images: 3,
      },
    });

    const finalPoster = { url, public_id, responsive: [] };
    const { breakpoints } = responsive_breakpoints[0];

    if (breakpoints.length) {
      for (let imgObject of breakpoints) {
        const { secure_url: url } = imgObject;
        finalPoster.responsive.push(url);
      }
    }
    newMovie.poster = finalPoster;
  }

  await newMovie.save();
  res.status(201).json({ id: newMovie._id, title });
};

// UPDATE MOVIE WITHOUT POSTER FUNCTION
const updateMovieWithoutPoster = async (req, res) => {
  const { movieId } = req.params;
  if (!isValidObjectId(movieId)) return res.json({ error: "Invalid Movie Id" });

  const movie = await Movie.findById(movieId);
  if (!movie) return res.status(404).json({ error: "Movie Not Found" });

  const {
    title,
    storyLine,
    director,
    releaseDate,
    status,
    type,
    genres,
    tags,
    cast,
    writers,
    trailer,
    language,
  } = req.body;

  movie.title = title;
  movie.storyLine = storyLine;
  movie.tags = tags;
  movie.releaseDate = releaseDate;
  movie.status = status;
  movie.type = type;
  movie.genres = genres;
  movie.cast = cast;
  movie.trailer = trailer;
  movie.language = language;

  if (director) {
    if (!isValidObjectId(director))
      return res.json({ error: "Invalid Director Id" });
    movie.director = director;
  }

  if (writers) {
    for (let w of writers) {
      if (!isValidObjectId(w)) return res.json({ error: "Invalid Writer Id" });
    }
    movie.writers = writers;
  }

  await movie.save();

  res.json({ message: "Movie is Updated", movie });
};

// UPDATE MOVIE WITH POSTER FUNCTION
const updateMovie = async (req, res) => {
  const { movieId } = req.params;
  const { file } = req;

  if (!isValidObjectId(movieId)) return res.json({ error: "Invalid Movie Id" });

  // if (!req.file) return req.json({ error: "Movie poster is Missing" });

  const movie = await Movie.findById(movieId);
  if (!movie) return res.status(404).json({ error: "Movie Not Found" });

  const {
    title,
    storyLine,
    director,
    releaseDate,
    status,
    type,
    genres,
    tags,
    cast,
    writers,
    trailer,
    language,
  } = req.body;

  movie.title = title;
  movie.storyLine = storyLine;
  movie.tags = tags;
  movie.releaseDate = releaseDate;
  movie.status = status;
  movie.type = type;
  movie.genres = genres;
  movie.cast = cast;
  movie.language = language;

  if (director) {
    if (!isValidObjectId(director))
      return res.json({ error: "Invalid Director Id" });
    movie.director = director;
  }

  if (writers) {
    for (let w of writers) {
      if (!isValidObjectId(w)) return res.json({ error: "Invalid Writer Id" });
    }
    movie.writers = writers;
  }

  //Update poster
  if (file) {
    const posterId = movie.poster?.public_id;
    if (posterId) {
      const { result } = await cloudinary.v2.uploader.destroy(posterId);
      if (result !== "ok") {
        res.json({ error: "Could not Update Poster" });
      }
    }

    // uploading poster
    const {
      secure_url: url,
      public_id,
      responsive_breakpoints,
    } = await cloudinary.v2.uploader.upload(req.file?.path, {
      transformation: { width: 1280, height: 720 },
      responsive_breakpoints: {
        create_derived: true,
        max_width: 640,
        max_images: 3,
      },
    });

    const finalPoster = { url, public_id, responsive: [] };
    const { breakpoints } = responsive_breakpoints[0];

    if (breakpoints.length) {
      for (let imgObject of breakpoints) {
        const { secure_url: url } = imgObject;
        finalPoster.responsive.push(url);
      }
    }

    movie.poster = finalPoster;
  }

  await movie.save();
  res.json({
    message: "Movie is Updated",
    movie: {
      id: movie._id,
      title: movie.title,
      poster: movie.poster?.url,
      genres: movie.genres,
      status: movie.status,
    },
  });
};

// DELETE MOVIE FUNCTION
const deleteMovie = async (req, res) => {
  const { movieId } = req.params;
  if (!isValidObjectId(movieId)) return res.json({ error: "Invalid Movie Id" });

  const movie = await Movie.findById(movieId);
  if (!movie) return res.status(404).json({ error: "Movie Not Found" });

  // Check if there is a poster & remove that
  const posterId = movie.poster?.public_id;

  if (posterId) {
    const { result } = await cloudinary.v2.uploader.destroy(posterId);
    if (result !== "ok") {
      return res.json({ error: "could not remove poster from Cloudinary" });
    }
  }

  // Removing Trailer
  const trailerId = movie.trailer?.public_id;
  if (!trailerId) return res.json({ error: "could not Find & Delete Trailer" });

  const { result } = await cloudinary.v2.uploader.destroy(trailerId, {
    resource_type: "video",
  });

  if (result !== "ok")
    return res.json({ error: "could not remove Trailer from Cloudinary" });

  await Movie.findByIdAndDelete(movieId);

  res.json({ message: "Movie Deleted Successfully 🎉" });
};

// GET MOVIES
const getMovies = async (req, res) => {
  const { pageNo = 0, limit = 10 } = req.query;

  const movies = await Movie.find({})
    .sort({ createdAt: -1 })
    .skip(parseInt(pageNo) * parseInt(limit))
    .limit(parseInt(limit));

  const results = movies.map((movie) => ({
    id: movie._id,
    title: movie.title,
    poster: movie.poster?.url,
    responsivePosters: movie.poster?.responsive,
    genres: movie.genres,
    status: movie.status,
  }));

  res.json({ movies: results });
};

// Update Movie
const getMovieForUpdate = async (req, res) => {
  const { movieId } = req.params;
  if (!isValidObjectId(movieId))
    return res.json({ error: "Movie Id is Invalid!" });

  const movie = await Movie.findById(movieId).populate(
    "director writers cast.actor"
  );

  res.json({
    movie: {
      id: movie._id,
      title: movie.title,
      storyLine: movie.storyLine,
      poster: movie.poster?.url,
      releaseDate: movie.releaseDate,
      status: movie.status,
      type: movie.type,
      language: movie.language,
      genres: movie.genres,
      tags: movie.tags,
      director: formatActor(movie.director),
      writers: movie.writers.map((w) => formatActor(w)),
      cast: movie.cast.map((c) => ({
        id: c.id,
        profile: formatActor(c.actor),
        roleAs: c.roleAs,
        leadActor: c.leadActor,
      })),
    },
  });
};

// SEARCH MOVIE
const searchMovie = async (req, res) => {
  const { title } = req.query;

  if (!title.trim()) return res.json({ error: "Invalid Search ❌" });

  const movies = await Movie.find({ title: { $regex: title, $options: "i" } });
  res.json({
    results: movies.map((m) => {
      return {
        id: m._id,
        title: m.title,
        poster: m.poster?.url,
        genres: m.genres,
        status: m.status,
      };
    }),
  });
};

// GET SINGLE MOVIE
const getSingleMovie = async (req, res) => {
  const { movieId } = req.params;

  if (!isValidObjectId(movieId)) return res.json({ error: "Invalid MovieId!" });

  const movie = await Movie.findById(movieId).populate(
    "director writers cast.actor"
  );

  // const [aggregatedRes] = await Review.aggregate(
  //   averageRatingPipeline(movie._id)
  // );
  // const reviews = {};

  // if (aggregatedRes) {
  //   const { ratingAvg, reviewCount } = aggregatedRes;
  //   reviews.ratingAvg = parseFloat(ratingAvg).toFixed(1);
  //   reviews.reviewsCount = reviewCount;
  // }

  const reviews = await getAverageRatings(movie._id);

  const {
    _id: id,
    title,
    storyLine,
    cast,
    writers,
    director,
    releaseDate,
    genres,
    tags,
    language,
    poster,
    trailer,
    type,
  } = movie;

  res.json({
    movie: {
      id,
      title,
      storyLine,
      releaseDate,
      genres,
      tags,
      language,
      poster: poster?.url,
      trailer: trailer?.url,
      type,
      cast: cast.map((c) => ({
        id: c._id,
        profile: {
          id: c.actor?._id,
          name: c.actor?.name,
          avatar: c.actor?.avatar?.url,
        },
        leadActor: c.leadActor,
        roleAs: c.roleAs,
      })),
      writers: writers.map((w) => ({
        id: w._id,
        name: w.name,
      })),
      director: {
        id: director._id,
        name: director.name,
      },
      reviews: { ...reviews },
    },
  });
};

// GET LATEST UPLOADS
const getLatestUploads = async (req, res) => {
  const { limit = 5 } = req.query;

  const results = await Movie.find({ status: "public" })
    .sort("-createdAt")
    .limit(parseInt(limit));

  const movies = results.map((m) => {
    return {
      id: m._id,
      title: m.title,
      poster: m.poster?.url,
      responsivePosters: m.poster.responsive,
      trailer: m.trailer?.url,
      storyLine: m.storyLine,
    };
  });

  res.json({ movies });
};

// GET RELATED MOVIES
const getRelatedMovies = async (req, res) => {
  const { movieId } = req.params;
  if (!isValidObjectId(movieId)) return res.json({ error: "Invalid Movie ID" });

  const movie = await Movie.findById(movieId);

  const movies = await Movie.aggregate(
    relatedMovieAggregation(movie.tags, movie._id)
  );

  const relatedMovies = await Promise.all(
    movies.map(async (m) => {
      const reviews = await getAverageRatings(m._id);

      return {
        id: m._id,
        title: m.title,
        poster: m.poster,
        responsivePosters: m.responsivePosters,
        reviews: { ...reviews },
      };
    })
  );

  res.json({ movies: relatedMovies });
};

// GET TOP RATED MOVIES
const getTopRatedMovies = async (req, res) => {
  const { type = "Film" } = req.query;

  const movies = await Movie.aggregate(topRatedMoviesPipeline(type));

  const topRatedMovies = await Promise.all(
    movies.map(async (m) => {
      const reviews = await getAverageRatings(m._id);
      return {
        id: m._id,
        title: m.title,
        poster: m.poster,
        responsivePosters: m.responsivePosters,
        reviews: { ...reviews },
      };
    })
  );

  res.json({ movies: topRatedMovies });
};

// SEARCH MOVIE (PUBLIC)
const searchPublicMovies = async (req, res) => {
  const { title } = req.query;

  if (!title.trim()) return res.json({ error: "Invalid Search ❌" });

  const movies = await Movie.find({
    title: { $regex: title, $options: "i" },
    status: "public",
  });

  const topRatedMovies = await Promise.all(
    movies.map(async (m) => {
      const reviews = await getAverageRatings(m._id);
      return {
        id: m._id,
        title: m.title,
        poster: m.poster?.url,
        responsivePosters: m.poster?.responsive,
        reviews: { ...reviews },
      };
    })
  );

  res.json({ topRatedMovies });
};

module.exports = {
  uploadTrailer,
  createMovie,
  updateMovieWithoutPoster,
  updateMovie,
  deleteMovie,
  getMovies,
  searchMovie,
  getMovieForUpdate,
  getSingleMovie,
  getLatestUploads,
  getRelatedMovies,
  getTopRatedMovies,
  searchPublicMovies,
};
